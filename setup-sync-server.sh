#!/bin/bash

# Bash Automated Installer for AntiMini Sync Server & MinIO
# Suitable for Ubuntu/Debian/CentOS Linux systems

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}      AntiMini Sync Server & MinIO Auto Installer         ${NC}"
echo -e "${GREEN}==========================================================${NC}"

# Check for root/sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run this script with sudo or as root!${NC}"
  exit 1
fi

# 1. Ask for antimini-sync path
read -p "Enter the absolute path to your 'antimini-sync' directory (e.g., /opt/antimini-sync): " syncPath
if [ -z "$syncPath" ]; then
  echo -e "${RED}Directory path cannot be empty!${NC}"
  exit 1
fi

if [ ! -d "$syncPath" ]; then
  echo -e "${YELLOW}Directory '$syncPath' does not exist. Creating it now...${NC}"
  mkdir -p "$syncPath"
fi

# Ensure package.json is in the target directory, or copy/download it if missing
if [ ! -f "$syncPath/package.json" ]; then
  if [ -d "./antimini-sync" ] && [ -f "./antimini-sync/package.json" ]; then
    echo -e "${YELLOW}Found 'antimini-sync' source folder in current directory. Copying files to '$syncPath'...${NC}"
    cp -a ./antimini-sync/. "$syncPath/"
  elif [ -f "./package.json" ] && grep -q '"name": "antimini-sync"' "./package.json" 2>/dev/null; then
    echo -e "${YELLOW}Current directory is 'antimini-sync'. Copying files to '$syncPath'...${NC}"
    cp -a ./. "$syncPath/"
  else
    # Automatically download from the public releases repository!
    echo -e "${YELLOW}Downloading 'antimini-sync' source code from the official releases repository...${NC}"
    if command -v git &> /dev/null; then
      tempDir=$(mktemp -d)
      git clone --depth 1 https://github.com/minhhungtsbd/AntiMini-Releases.git "$tempDir" &>/dev/null
      if [ -d "$tempDir/antimini-sync" ]; then
        cp -a "$tempDir/antimini-sync/." "$syncPath/"
        rm -rf "$tempDir"
      else
        echo -e "${RED}Error: Failed to locate 'antimini-sync' in the downloaded repository.${NC}"
        rm -rf "$tempDir"
        exit 1
      fi
    else
      # If git is not installed, install git or try downloading zip archive via curl
      echo -e "${YELLOW}git not found. Installing git...${NC}"
      if command -v apt-get &> /dev/null; then
        apt-get update -y &>/dev/null && apt-get install -y git &>/dev/null
      elif command -v dnf &> /dev/null; then
        dnf install -y git &>/dev/null
      elif command -v yum &> /dev/null; then
        yum install -y git &>/dev/null
      fi
      
      # Try cloning again
      if command -v git &> /dev/null; then
        tempDir=$(mktemp -d)
        git clone --depth 1 https://github.com/minhhungtsbd/AntiMini-Releases.git "$tempDir" &>/dev/null
        cp -a "$tempDir/antimini-sync/." "$syncPath/"
        rm -rf "$tempDir"
      else
        # Fallback to downloading zip archive via curl
        echo -e "${YELLOW}Downloading zip archive of releases repository...${NC}"
        if command -v unzip &> /dev/null; then
          tempZip="/tmp/antimini-releases.zip"
          curl -fsSL -o "$tempZip" https://github.com/minhhungtsbd/AntiMini-Releases/archive/refs/heads/main.zip
          tempDir="/tmp/antimini-releases-extracted"
          mkdir -p "$tempDir"
          unzip -q "$tempZip" -d "$tempDir"
          cp -a "$tempDir/AntiMini-Releases-main/antimini-sync/." "$syncPath/"
          rm -rf "$tempZip" "$tempDir"
        else
          echo -e "${RED}Error: Neither git nor unzip is installed. Please install git or unzip manually, or upload the source code to '$syncPath'.${NC}"
          exit 1
        fi
      fi
    fi
  fi
fi

# 2. Ask for Sync Token / License Key
defaultToken=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "antimini-secret-sync-token-2026")
read -p "Enter a custom secure Sync Token (Press Enter to auto-generate: $defaultToken): " syncToken
if [ -z "$syncToken" ]; then
  syncToken=$defaultToken
fi

# 3. Ask for Port
read -p "Enter the port for NestJS Sync Server (Press Enter to default: 8987): " port
if [ -z "$port" ]; then
  port="8987"
fi

# 4. Option to setup MinIO locally
read -p "Do you want to download and set up MinIO (S3 storage) locally? (Y/N) [Default: Y]: " setupMinIO
if [ -z "$setupMinIO" ]; then
  setupMinIO="Y"
fi

s3Endpoint=""
s3Region="us-east-1"
s3AccessKey=""
s3SecretKey=""
s3Bucket=""
s3ForcePathStyle="true"

if [[ "$setupMinIO" =~ ^[Yy]$ ]]; then
  echo -e "\n${CYAN}--- Configuring Local MinIO ---${NC}"
  
  minioDir="/opt/minio"
  minioDataDir="/opt/minio/data"
  
  mkdir -p "$minioDir"
  mkdir -p "$minioDataDir"
  
  # Download MinIO binary if not already present
  minioExe="$minioDir/minio"
  if [ ! -f "$minioExe" ]; then
    echo -e "${YELLOW}Downloading MinIO executable...${NC}"
    curl -L -o "$minioExe" https://dl.min.io/server/minio/release/linux-amd64/minio
    chmod +x "$minioExe"
  fi
  
  # Set default MinIO Credentials
  s3Endpoint="http://localhost:9000"
  s3AccessKey="minioadmin"
  s3SecretKey="minioadmin"
  s3Bucket="antimini-sync"
  
  # Create startup script for MinIO
  cat <<EOF > "$minioDir/start-minio.sh"
#!/bin/bash
export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin
echo "Starting MinIO Server on port 9000..."
"$minioExe" server "$minioDataDir" --address :9000 --console-address :9001
EOF
  chmod +x "$minioDir/start-minio.sh"
  echo -e "${GREEN}Created MinIO startup script at: $minioDir/start-minio.sh${NC}"
  
else
  echo -e "\n${CYAN}--- Configuring Custom S3 Storage (AWS / Cloudflare R2) ---${NC}"
  read -p "Enter S3 Endpoint URL (e.g., https://<account_id>.r2.cloudflarestorage.com): " s3Endpoint
  read -p "Enter S3 Region (Press Enter to default: us-east-1): " s3Region
  if [ -z "$s3Region" ]; then s3Region="us-east-1"; fi
  read -p "Enter S3 Access Key ID: " s3AccessKey
  read -p "Enter S3 Secret Access Key: " s3SecretKey
  read -p "Enter S3 Bucket Name: " s3Bucket
fi

# 5. Write .env file
cat <<EOF > "$syncPath/.env"
SYNC_TOKEN=$syncToken
PORT=$port
S3_ENDPOINT=$s3Endpoint
S3_REGION=$s3Region
S3_ACCESS_KEY_ID=$s3AccessKey
S3_SECRET_ACCESS_KEY=$s3SecretKey
S3_BUCKET=$s3Bucket
S3_FORCE_PATH_STYLE=$s3ForcePathStyle
EOF

echo -e "\n${GREEN}Successfully created '.env' file at: $syncPath/.env${NC}"

# 6. Install dependencies and compile
echo -e "\n${YELLOW}Installing packages and building the Sync Server...${NC}"
cd "$syncPath"

# Install Node.js & npm if missing
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}Node.js not found. Installing Node.js & npm...${NC}"
  if command -v apt-get &> /dev/null; then
    # Debian/Ubuntu
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v dnf &> /dev/null; then
    # Fedora/CentOS 8+
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  elif command -v yum &> /dev/null; then
    # CentOS 7
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    echo -e "${RED}Unsupported package manager. Please install Node.js manually and run this script again.${NC}"
    exit 1
  fi
fi

# Ensure npm is installed
if ! command -v npm &> /dev/null; then
  echo -e "${YELLOW}npm not found. Installing npm...${NC}"
  if command -v apt-get &> /dev/null; then
    apt-get install -y npm
  elif command -v dnf &> /dev/null; then
    dnf install -y npm
  elif command -v yum &> /dev/null; then
    yum install -y npm
  fi
fi

# Install pnpm if missing
if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}Installing pnpm globally...${NC}"
  npm install -g pnpm
fi

pnpm install
pnpm run build

echo -e "\n${GREEN}==========================================================${NC}"
echo -e "${GREEN}                 INSTALLATION COMPLETED!                  ${NC}"
echo -e "${GREEN}==========================================================${NC}"
echo -e "Sync Token (License Key): ${CYAN}$syncToken${NC}"
echo -e "Sync Server Port: ${CYAN}$port${NC}"
echo -e "${GREEN}==========================================================${NC}"

if [[ "$setupMinIO" =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}IMPORTANT: Start MinIO storage in the background:${NC}"
  echo -e "  nohup $minioDir/start-minio.sh > $minioDir/minio.log 2>&1 &"
fi
echo -e "\nTo run the Sync Server in the background (Recommended for Production):"
echo -e "  npm install -g pm2"
echo -e "  cd $syncPath"
echo -e "  pm2 start dist/src/main.js --name \"antimini-sync\""
echo -e "  pm2 startup"
echo -e "  pm2 save"
echo -e "\nOr run it directly in foreground:"
echo -e "  cd $syncPath"
echo -e "  pnpm run start:prod"

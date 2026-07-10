#!/bin/bash

# Fast updater for an existing AntiMini Sync Server install.
# It preserves .env and MinIO data, refreshes only /opt/antimini-sync source,
# rebuilds the NestJS app, and restarts PM2.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

syncPath="${1:-/opt/antimini-sync}"
repoUrl="https://github.com/minhhungtsbd/AntiMini-Releases.git"

echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}             AntiMini Sync Server Updater                 ${NC}"
echo -e "${GREEN}==========================================================${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run this script with sudo or as root.${NC}"
  exit 1
fi

case "$syncPath" in
  ""|"/"|"/opt"|"/root"|"/home"|"/usr"|"/var")
    echo -e "${RED}Refusing unsafe sync path: '$syncPath'${NC}"
    exit 1
    ;;
esac

if [ ! -d "$syncPath" ]; then
  echo -e "${RED}Sync directory does not exist: $syncPath${NC}"
  echo -e "${YELLOW}Run setup-sync-server.sh first for a fresh install.${NC}"
  exit 1
fi

if [ ! -f "$syncPath/.env" ]; then
  echo -e "${RED}Missing $syncPath/.env. Update requires an existing install.${NC}"
  exit 1
fi

for cmd in curl node npm; do
  if ! command -v "$cmd" &> /dev/null; then
    echo -e "${RED}Missing required command: $cmd${NC}"
    exit 1
  fi
done

if ! command -v git &> /dev/null; then
  echo -e "${YELLOW}git not found. Installing git...${NC}"
  if command -v apt-get &> /dev/null; then
    apt-get update -y
    apt-get install -y git
  elif command -v dnf &> /dev/null; then
    dnf install -y git
  elif command -v yum &> /dev/null; then
    yum install -y git
  else
    echo -e "${RED}Unsupported package manager. Please install git manually.${NC}"
    exit 1
  fi
fi

if ! command -v pnpm &> /dev/null; then
  echo -e "${YELLOW}Installing pnpm globally...${NC}"
  npm install -g pnpm
fi

if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}Installing pm2 globally...${NC}"
  npm install -g pm2
fi

tempDir=$(mktemp -d)
envBackup=$(mktemp)
cleanup() {
  rm -rf "$tempDir"
  rm -f "$envBackup" /tmp/antimini-sync-update-check.log
}
trap cleanup EXIT

echo -e "${CYAN}Downloading latest sync server source...${NC}"
git clone --depth 1 "$repoUrl" "$tempDir" &>/dev/null

if [ ! -f "$tempDir/antimini-sync/package.json" ]; then
  echo -e "${RED}Downloaded repository does not contain antimini-sync/package.json.${NC}"
  exit 1
fi

cp "$syncPath/.env" "$envBackup"

echo -e "${CYAN}Stopping current PM2 process if it exists...${NC}"
pm2 stop antimini-sync &>/dev/null || true

echo -e "${CYAN}Refreshing source in $syncPath...${NC}"
find "$syncPath" -mindepth 1 -maxdepth 1 ! -name ".env" -exec rm -rf {} +
cp -a "$tempDir/antimini-sync/." "$syncPath/"
cp "$envBackup" "$syncPath/.env"
rm -f "$syncPath/tsconfig.build.tsbuildinfo"
rm -rf "$syncPath/dist"

cd "$syncPath"

echo -e "${CYAN}Installing dependencies...${NC}"
pnpm install --frozen-lockfile || pnpm install

echo -e "${CYAN}Building sync server...${NC}"
pnpm run build

if [ ! -f "$syncPath/dist/main.js" ]; then
  echo -e "${RED}Build completed but dist/main.js was not created.${NC}"
  echo -e "${YELLOW}Files under dist:${NC}"
  find "$syncPath/dist" -maxdepth 4 -type f 2>/dev/null || true
  exit 1
fi

echo -e "${CYAN}Starting PM2 process...${NC}"
pm2 delete antimini-sync &>/dev/null || true
pm2 start "$syncPath/dist/main.js" --name antimini-sync
pm2 save

port=$(grep -E '^PORT=' "$syncPath/.env" | tail -n 1 | cut -d= -f2-)
if [ -z "$port" ]; then
  port="8987"
fi

echo -e "${CYAN}Checking local endpoint on port $port...${NC}"
sleep 2
httpCode=$(curl -sS -o /tmp/antimini-sync-update-check.log -w "%{http_code}" "http://127.0.0.1:$port/v1/profile-locks" || true)
if [ "$httpCode" = "200" ] || [ "$httpCode" = "401" ] || [ "$httpCode" = "403" ]; then
  echo -e "${GREEN}Endpoint responded with HTTP $httpCode.${NC}"
else
  echo -e "${YELLOW}Endpoint check returned HTTP $httpCode. Showing PM2 status and recent logs:${NC}"
  pm2 status
  pm2 logs antimini-sync --lines 80 --nostream || true
  exit 1
fi

echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}      AntiMini Sync Server updated successfully.          ${NC}"
echo -e "${GREEN}==========================================================${NC}"
echo -e "Path: ${CYAN}$syncPath${NC}"
echo -e "Port: ${CYAN}$port${NC}"

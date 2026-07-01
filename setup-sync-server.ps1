# PowerShell Automated Installer for AntiMini Sync Server & MinIO
# Must be run as Administrator

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "      AntiMini Sync Server & MinIO Auto Installer" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

# Ensure Administrator rights
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) {
    Write-Error "Please run this script as Administrator!"
    Exit
}

# 1. Ask for antimini-sync path
$syncPath = Read-Host "Enter the absolute path to your 'antimini-sync' directory (e.g., C:\AntiMini\antimini-sync)"
if ([string]::IsNullOrEmpty($syncPath)) {
    Write-Host "Directory path cannot be empty!" -ForegroundColor Red
    Exit
}

if (!(Test-Path $syncPath)) {
    Write-Host "Directory '$syncPath' does not exist. Creating it now..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $syncPath -Force | Out-Null
}

# Ensure package.json is in the target directory, or copy/download it if missing
$packageJsonPath = Join-Path $syncPath "package.json"
if (!(Test-Path $packageJsonPath)) {
    if (Test-Path ".\antimini-sync\package.json") {
        Write-Host "Found 'antimini-sync' source folder in current directory. Copying files to '$syncPath'..." -ForegroundColor Yellow
        Copy-Item -Path ".\antimini-sync\*" -Destination $syncPath -Recurse -Force
    } elseif ((Test-Path ".\package.json") -and (Get-Content ".\package.json" -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction SilentlyContinue).name -eq "antimini-sync") {
        Write-Host "Current directory is 'antimini-sync'. Copying files to '$syncPath'..." -ForegroundColor Yellow
        Copy-Item -Path ".\*" -Destination $syncPath -Recurse -Force
    } else {
        # Automatically download from the public releases repository!
        Write-Host "Downloading 'antimini-sync' source code from the official releases repository..." -ForegroundColor Yellow
        $tempZip = Join-Path $env:TEMP "antimini-releases.zip"
        $zipUrl = "https://github.com/minhhungtsbd/AntiMini-Releases/archive/refs/heads/main.zip"
        Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing
        $extractDir = Join-Path $env:TEMP "antimini-releases-extracted"
        if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
        Expand-Archive -Path $tempZip -DestinationPath $extractDir -Force
        
        $sourcePath = Join-Path $extractDir "AntiMini-Releases-main\antimini-sync"
        Copy-Item -Path "$sourcePath\*" -Destination $syncPath -Recurse -Force
        
        # Cleanup
        Remove-Item $tempZip -Force
        Remove-Item $extractDir -Recurse -Force
    }
}

# 2. Ask for Sync Token / License Key
$defaultToken = [Guid]::NewGuid().ToString()
$syncToken = Read-Host "Enter a custom secure Sync Token (Press Enter to auto-generate: $defaultToken)"
if ([string]::IsNullOrEmpty($syncToken)) {
    $syncToken = $defaultToken
}

# 3. Ask for Port
$port = Read-Host "Enter the port for NestJS Sync Server (Press Enter to default: 8987)"
if ([string]::IsNullOrEmpty($port)) {
    $port = "8987"
}

# 4. Option to setup MinIO locally
$setupMinIO = Read-Host "Do you want to download and set up MinIO (S3 storage) locally? (Y/N) [Default: Y]"
if ([string]::IsNullOrEmpty($setupMinIO)) {
    $setupMinIO = "Y"
}

$s3Endpoint = ""
$s3Region = "us-east-1"
$s3AccessKey = ""
$s3SecretKey = ""
$s3Bucket = ""
$s3ForcePathStyle = "true"

if ($setupMinIO -eq "Y" -or $setupMinIO -eq "y") {
    Write-Host "`n--- Configuring Local MinIO ---" -ForegroundColor Cyan
    
    $minioDir = "C:\MinIO"
    $minioDataDir = "C:\MinIO\data"
    
    if (!(Test-Path $minioDir)) {
        New-Item -ItemType Directory -Path $minioDir | Out-Null
    }
    if (!(Test-Path $minioDataDir)) {
        New-Item -ItemType Directory -Path $minioDataDir | Out-Null
    }
    
    # Download MinIO binary if not already present
    $minioExe = Join-Path $minioDir "minio.exe"
    if (!(Test-Path $minioExe)) {
        Write-Host "Downloading MinIO executable..." -ForegroundColor Yellow
        $minioUrl = "https://dl.min.io/server/minio/release/windows-amd64/minio.exe"
        Invoke-WebRequest -Uri $minioUrl -OutFile $minioExe -UseBasicParsing
    }
    
    # Set default MinIO Credentials
    $s3Endpoint = "http://localhost:9000"
    $s3AccessKey = "minioadmin"
    $s3SecretKey = "minioadmin"
    $s3Bucket = "antimini-sync"
    
    # Create startup script for MinIO
    $startScript = @"
@echo off
set MINIO_ROOT_USER=minioadmin
set MINIO_ROOT_PASSWORD=minioadmin
echo Starting MinIO Server on port 9000...
"$minioExe" server "$minioDataDir" --address :9000 --console-address :9001
"@
    
    $startScriptPath = Join-Path $minioDir "start-minio.bat"
    Set-Content -Path $startScriptPath -Value $startScript
    Write-Host "Created MinIO startup script at: $startScriptPath" -ForegroundColor Green
    
} else {
    Write-Host "`n--- Configuring Custom S3 Storage (AWS / Cloudflare R2) ---" -ForegroundColor Cyan
    $s3Endpoint = Read-Host "Enter S3 Endpoint URL (e.g., https://<account_id>.r2.cloudflarestorage.com)"
    $s3Region = Read-Host "Enter S3 Region (Press Enter to default: us-east-1)"
    if ([string]::IsNullOrEmpty($s3Region)) { $s3Region = "us-east-1" }
    $s3AccessKey = Read-Host "Enter S3 Access Key ID"
    $s3SecretKey = Read-Host "Enter S3 Secret Access Key"
    $s3Bucket = Read-Host "Enter S3 Bucket Name"
}

# 5. Write .env file
$envContent = @"
SYNC_TOKEN=$syncToken
PORT=$port
S3_ENDPOINT=$s3Endpoint
S3_REGION=$s3Region
S3_ACCESS_KEY_ID=$s3AccessKey
S3_SECRET_ACCESS_KEY=$s3SecretKey
S3_BUCKET=$s3Bucket
S3_FORCE_PATH_STYLE=$s3ForcePathStyle
"@

$envPath = Join-Path $syncPath ".env"
Set-Content -Path $envPath -Value $envContent
Write-Host "`nSuccessfully created '.env' file at: $envPath" -ForegroundColor Green

# 6. Install dependencies and compile
Write-Host "`nInstalling packages and building the Sync Server..." -ForegroundColor Yellow
cd $syncPath

# Install Node.js & npm if missing
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Downloading and installing Node.js (LTS)..." -ForegroundColor Yellow
    $msiPath = Join-Path $env:TEMP "node-install.msi"
    $nodeUrl = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $msiPath -UseBasicParsing
    Write-Host "Running silent installation..." -ForegroundColor Yellow
    $installProcess = Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /qn /norestart" -Wait -PassThru
    # Refresh Path environment variable in the current process
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
    
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Failed to install Node.js automatically. Please install Node.js manually (https://nodejs.org) and run this script again."
        Exit
    }
}

# Install pnpm if missing
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing pnpm globally..." -ForegroundColor Yellow
    npm install -g pnpm
}

pnpm install
pnpm run build

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "                 INSTALLATION COMPLETED!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Sync Token (License Key): $syncToken" -ForegroundColor Green
Write-Host "Sync Server Port: $port" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

if ($setupMinIO -eq "Y" -or $setupMinIO -eq "y") {
    Write-Host "IMPORTANT: Start MinIO storage in the background:" -ForegroundColor Yellow
    Write-Host "  Start-Process -FilePath `"$startScriptPath`" -WindowStyle Hidden" -ForegroundColor Yellow
}
Write-Host "`nTo run the Sync Server in the background (Recommended for Production):" -ForegroundColor Cyan
Write-Host "  npm install -g pm2" -ForegroundColor Cyan
Write-Host "  cd $syncPath" -ForegroundColor Cyan
Write-Host "  pm2 start dist/main.js --name `"antimini-sync`"" -ForegroundColor Cyan
Write-Host "`nOr run it directly in foreground:" -ForegroundColor Cyan
Write-Host "  cd $syncPath" -ForegroundColor Cyan
Write-Host "  pnpm run start:prod" -ForegroundColor Cyan

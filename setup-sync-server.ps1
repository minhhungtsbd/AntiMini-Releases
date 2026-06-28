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
    Write-Host "IMPORTANT: Please run '$startScriptPath' first to start MinIO storage!" -ForegroundColor Yellow
}
Write-Host "To run the Sync Server, execute:" -ForegroundColor Cyan
Write-Host "  cd $syncPath" -ForegroundColor Cyan
Write-Host "  pnpm run start:prod" -ForegroundColor Cyan

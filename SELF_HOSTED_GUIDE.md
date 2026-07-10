# Hướng Dẫn Cài Đặt Self-hosted Sync Server cho AntiMini Browser

Tài liệu này hướng dẫn chi tiết cách tự vận hành (Self-host) máy chủ đồng bộ dữ liệu và kích hoạt gói Pro cho trình duyệt AntiMini Browser.

---

## 🛠️ Yêu cầu hệ thống

* **Hệ điều hành**: Windows Server 2016+ hoặc Ubuntu 20.04+ (Khuyên dùng Linux VPS).
* **Node.js**: Phiên bản **v18.x** hoặc **v20.x**.
* **Trình quản lý gói**: `npm` hoặc `pnpm`.
* **Bộ lưu trữ**: Bộ lưu trữ S3 tùy chọn (AWS S3, Cloudflare R2) hoặc tự chạy **MinIO** cục bộ.

---

## 🚀 Cách 1: Sử dụng Script Tự Động Thiết Lập (Khuyên dùng)

Chúng tôi đã viết sẵn các script tự động hóa để hướng dẫn bạn thiết lập từ A-Z, bao gồm cả tùy chọn tải và cấu hình **MinIO**.

### Trên Windows (PowerShell)
1. Mở PowerShell dưới quyền **Administrator** (Run as Administrator) và chạy lệnh để tải script:
   ```powershell
   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/minhhungtsbd/AntiMini-Releases/main/setup-sync-server.ps1" -OutFile "setup-sync-server.ps1"
   ```
2. Thực thi script:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   .\setup-sync-server.ps1
   ```
3. Làm theo các câu hỏi hiển thị trên màn hình để cấu hình.

### Trên Linux (Bash)
1. Tải script về máy chủ bằng lệnh:
   ```bash
   curl -O https://raw.githubusercontent.com/minhhungtsbd/AntiMini-Releases/main/setup-sync-server.sh
   ```
2. Cấp quyền thực thi và chạy:
   ```bash
   chmod +x setup-sync-server.sh
   ./setup-sync-server.sh
   ```
3. Nhập các thông số cấu hình theo hướng dẫn của script.

---

## ✍️ Cách 2: Cấu Hình Thủ Công

Nếu bạn muốn cấu hình từng bước thủ công, hãy thực hiện theo các bước dưới đây:

### Bước 1: Chuẩn bị mã nguồn Sync Server
1. Tải thư mục `antimini-sync` từ nguồn phát hành của bạn về máy chủ.
2. Chạy lệnh cài đặt các thư viện phụ thuộc:
   ```bash
   npm install -g pnpm
   pnpm install
   ```

### Bước 2: Thiết lập cấu hình `.env`
Tạo một file có tên là `.env` nằm trong thư mục gốc của `antimini-sync` với nội dung cấu hình sau:

```env
# Khóa kết nối của ứng dụng client (tự tạo khóa bảo mật của bạn)
SYNC_TOKEN=your-custom-secure-token

# Cổng chạy dịch vụ API
PORT=8987

# Cấu hình kết nối S3 Storage
S3_ENDPOINT=http://localhost:9000      # Đổi thành URL S3 của bạn nếu dùng Cloudflare R2 / AWS S3
S3_PUBLIC_ENDPOINT=                    # Nếu dùng MinIO qua domain/tunnel, đặt URL public tại đây, ví dụ: https://antimini-sync.cloudmini.net
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin            # Access Key
S3_SECRET_ACCESS_KEY=minioadmin        # Secret Key
S3_BUCKET=antimini-sync                # Tên bucket lưu trữ
S3_FORCE_PATH_STYLE=true
```

### Bước 3: Khởi chạy Máy chủ Đồng bộ

#### Cách A: Chạy ngầm bằng PM2 (Khuyên dùng cho môi trường thực tế)
Để đảm bảo các dịch vụ hoạt động liên tục ngay cả khi bạn đóng cửa sổ Terminal SSH:

1. **Khởi chạy MinIO cục bộ (nếu cài MinIO)**:
   ```bash
   nohup /opt/minio/start-minio.sh > /opt/minio/minio.log 2>&1 &
   ```
2. **Cài đặt PM2 toàn hệ thống**:
   ```bash
   npm install -g pm2
   ```
3. **Khởi chạy Sync Server bằng PM2**:
   ```bash
   cd /opt/antimini-sync
   pnpm run build
   pm2 start dist/main.js --name "antimini-sync"
   ```
4. **Cấu hình tự khởi động khi reboot máy chủ**:
   ```bash
   pm2 startup
   pm2 save
   ```

#### Cách B: Khởi chạy trực tiếp (Để kiểm tra nhanh)
1. Khởi chạy MinIO:
   ```bash
   /opt/minio/start-minio.sh &
   ```
2. Khởi chạy Sync Server:
   ```bash
   cd /opt/antimini-sync
   pnpm run build
   pnpm run start:prod
   ```
Dịch vụ sẽ bắt đầu lắng nghe tại cổng đã cấu hình (ví dụ: `8987`).

---

## 🔄 Cập Nhật Sync Server

Nếu bạn đã cài `antimini-sync` bằng script tự động trước đó, không cần cài lại MinIO hoặc nhập lại cấu hình. Chạy lệnh sau trên VPS để cập nhật source mới nhất, rebuild và restart PM2:

```bash
curl -fsSL https://raw.githubusercontent.com/minhhungtsbd/AntiMini-Releases/main/update-sync-server.sh | bash -s -- /opt/antimini-sync
```

Script cập nhật sẽ giữ nguyên file `.env`, không đụng vào dữ liệu MinIO trong `/opt/minio`, xoá cache build TypeScript, build lại `dist/main.js`, restart process `antimini-sync` trong PM2 và kiểm tra endpoint `/v1/profile-locks`.

Sau khi chạy xong, có thể kiểm tra nhanh:

```bash
pm2 status
curl -i http://127.0.0.1:8987/v1/profile-locks
```

Kết quả `401 Unauthorized` hoặc `403` là bình thường nếu chưa gửi token, miễn là không còn lỗi `Connection refused`.

---

## 🌐 Dùng Domain / Cloudflare Tunnel Với MinIO Local

Khi dùng MinIO local, không đặt `S3_ENDPOINT` thành domain public nếu server vẫn cần kết nối MinIO qua localhost. Hãy tách hai endpoint:

```env
S3_ENDPOINT=http://127.0.0.1:9000
S3_PUBLIC_ENDPOINT=https://antimini-sync.cloudmini.net
```

`S3_ENDPOINT` là đường nội bộ để NestJS nói chuyện với MinIO. `S3_PUBLIC_ENDPOINT` là URL được ký và trả về cho AntiMini Browser, nên giá trị này phải truy cập được từ máy chạy ứng dụng.

Nếu dùng chung một domain cho cả API và MinIO, reverse proxy/tunnel cần route:

```text
/v1/*              -> NestJS sync server
/antimini-sync/*   -> MinIO
```

---

## 🔒 Hướng dẫn cấu hình trên ứng dụng AntiMini Browser

1. Mở ứng dụng AntiMini Browser, truy cập vào phần **Cài đặt** (Settings) -> **Đồng bộ & Sao lưu** (Sync & Backup).
2. Nhập URL máy chủ của bạn vào ô **Sync Server URL**:
   * Ví dụ: `http://<IP_MAY_CHU_CUA_BAN>:8987`
3. Nhập mã khóa kết nối vào ô **Sync Token / License Key** (trùng với giá trị `SYNC_TOKEN` bạn cấu hình ở file `.env`).
4. Nhấn **Connect** (Kết nối). Hệ thống sẽ tự động liên kết và kích hoạt đầy đủ các tính năng Pro!

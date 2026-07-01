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
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin            # Access Key
S3_SECRET_ACCESS_KEY=minioadmin        # Secret Key
S3_BUCKET=antimini-sync                # Tên bucket lưu trữ
S3_FORCE_PATH_STYLE=true
```

### Bước 3: Khởi chạy Máy chủ Đồng bộ
1. Biên dịch dự án:
   ```bash
   pnpm run build
   ```
2. Khởi chạy trong môi trường production:
   ```bash
   pnpm run start:prod
   ```
Dịch vụ sẽ bắt đầu lắng nghe tại cổng đã cấu hình (ví dụ: `8987`).

---

## 🔒 Hướng dẫn cấu hình trên ứng dụng AntiMini Browser

1. Mở ứng dụng AntiMini Browser, truy cập vào phần **Cài đặt** (Settings) -> **Đồng bộ & Sao lưu** (Sync & Backup).
2. Nhập URL máy chủ của bạn vào ô **Sync Server URL**:
   * Ví dụ: `http://<IP_MAY_CHU_CUA_BAN>:8987`
3. Nhập mã khóa kết nối vào ô **Sync Token / License Key** (trùng với giá trị `SYNC_TOKEN` bạn cấu hình ở file `.env`).
4. Nhấn **Connect** (Kết nối). Hệ thống sẽ tự động liên kết và kích hoạt đầy đủ các tính năng Pro!

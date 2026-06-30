<p align="center">
  <img src="logo.png" alt="AntiMini Browser Logo" width="180">
</p>

<h1 align="center">AntiMini Browser Releases</h1>

<p align="center">
  <strong>Antimini ( Antidect Browser by Cloudmini )</strong><br>
  Trình duyệt chống phát hiện (Antidetect Browser) chuyên nghiệp dành cho Multi-Accounting, Tự động hóa & Bảo mật vân tay.
</p>

<p align="center">
  <a href="https://github.com/minhhungtsbd/AntiMini-Releases/releases/latest">
    <img src="https://img.shields.io/github/v/release/minhhungtsbd/AntiMini-Releases?color=blue&label=Bản%20mới%20nhất" alt="Latest Release">
  </a>
  <img src="https://img.shields.io/badge/Nền%20tảng-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen" alt="Platforms">
  <img src="https://img.shields.io/badge/Giấy%20phép-AGPL--3.0-orange" alt="License">
</p>

---

## 📌 Giới Thiệu Chung

Đây là kho lưu trữ phát hành chính thức (Public Releases) chứa các gói cài đặt đã được đóng gói sẵn và siêu dữ liệu (metadata) phục vụ cho cơ chế tự động kiểm tra và nâng cấp phiên bản của ứng dụng **AntiMini Browser**. Kho chứa mã nguồn chính của phần mềm được giữ riêng tư (private) để bảo mật.

**AntiMini Browser** là giải pháp trình duyệt antidetect tối ưu được phát triển dựa trên nhân Chromium tùy biến sâu, giúp bảo vệ danh tính trực tuyến và quản lý hàng nghìn tài khoản mạng xã hội, sàn thương mại điện tử, chiến dịch quảng cáo, airdrop mà không bị phát hiện hay liên đới chéo.

---

## 🚀 Các Tính Năng Cốt Lõi

### 1. 🛡️ Bảo Mật Vân Tay Trình Duyệt Toàn Diện (Advanced Fingerprint Masking)
Tự động thay đổi và giả lập cấu hình phần cứng chân thực cho từng Profile trình duyệt, bao gồm:
* **User Agent & OS**: Giả lập Windows, macOS, Linux với các phiên bản trình duyệt mới nhất.
* **Vân tay phần cứng**: CPU Cores, RAM, Độ phân giải màn hình, WebGL Vendor/Renderer.
* **Dữ liệu thuật toán**: Canvas Hash, Audio Fingerprint, WebGL Image, ClientRects.
* **Mạng & Vị trí**: WebRTC IP, Cấu hình múi giờ (Timezone), Ngôn ngữ, Vị trí địa lý (Geolocation) khớp với IP Proxy.

### 2. 🌐 Tích Hợp Sâu Proxy & VPN WireGuard
* Hỗ trợ đầy đủ các giao thức Proxy phổ biến: **SOCKS5**, **HTTP/HTTPS** (cả IPv4 và IPv6).
* Tích hợp trực tiếp công cụ kết nối **VPN WireGuard** cho phép định tuyến toàn bộ lưu lượng của từng Profile qua các đường truyền VPN riêng biệt siêu tốc.
* Hỗ trợ tự động kiểm tra chất lượng và tình trạng kết nối của Proxy/VPN trước khi khởi chạy trình duyệt.

### 3. ☁️ Đồng Bộ Hóa Đám Mây Tự Chủ (Self-Hosted Cloud Sync)
* Lưu trữ và đồng bộ hóa an toàn toàn bộ dữ liệu duyệt web bao gồm: Cookie, Lịch sử, Tab đang mở, Tiện ích mở rộng và Mật khẩu đã lưu.
* Hỗ trợ lưu trữ trên mọi dịch vụ tương thích S3 (MinIO, AWS S3, Cloudflare R2...) hoặc thông qua máy chủ đồng bộ riêng biệt tự chủ (**antimini-sync** server).

### 4. 🤖 REST API & MCP Tự Động Hóa Chuyên Sâu
* Hỗ trợ REST API toàn diện để điều khiển, quản lý profile, đóng/mở trình duyệt từ xa bằng mã code (Python, Node.js, Puppeteer, Playwright).
* Tích hợp giao thức **MCP (Model Context Protocol)** kết nối trực tiếp các mô hình AI để tự động hóa tác vụ duyệt web thông minh.

### 5. 📂 Quản Lý Nhóm & Tiện Ých Mở Rộng Hàng Loạt
* Phân loại profile theo nhóm, gắn thẻ tag màu sắc trực quan, tìm kiếm nhanh chóng.
* Quản lý và cài đặt hàng loạt Tiện ích mở rộng (Extensions) từ Chrome Web Store vào các profile chỉ với một click.

---

## 📥 Tải Xuống Bản Cài Đặt Mới Nhất

Vui lòng truy cập trang **[Releases](https://github.com/minhhungtsbd/AntiMini-Releases/releases/latest)** để tải về bộ cài đặt tương ứng với hệ điều hành của bạn:

* **Windows**: Bộ cài đặt tự động dạng `.exe` (khuyên dùng) hoặc `.msi`.
* **macOS**: Các gói cài đặt `.dmg` hỗ trợ cả Apple Silicon (M1/M2/M3) và Intel chip.
* **Linux**: Gói cài đặt định dạng `.deb` (Debian/Ubuntu), `.rpm` (RedHat/Fedora), hoặc `.AppImage` chạy trực tiếp.

---

## 🔄 Cơ Chế Tự Động Cập Nhật (Auto-Updater)

Ứng dụng **AntiMini Browser** được tích hợp sẵn bộ kiểm tra cập nhật tự động. Khi bạn khởi động phần mềm:
1. Ứng dụng sẽ ngầm truy vấn thông tin từ kho Releases này.
2. Nếu có phiên bản mới hơn phiên bản hiện tại, phần mềm sẽ hiển thị thông báo nâng cấp.
3. Người dùng chỉ cần đồng ý, ứng dụng sẽ tự động tải bản vá mới nhất về và cài đặt đè mà không làm mất bất kỳ dữ liệu profile hay cấu hình nào của bạn.

---

## 🛠️ Hướng Dẫn Tự Cài Đặt Máy Chủ Đồng Bộ (Self-Hosting Guide)

Nếu bạn muốn tự vận hành máy chủ đồng bộ đám mây riêng để kiểm soát hoàn toàn dữ liệu của mình, vui lòng tham khảo:
* **Tài liệu hướng dẫn**: [SELF_HOSTED_GUIDE.md](SELF_HOSTED_GUIDE.md)
* **Script cài đặt nhanh trên Linux**: [setup-sync-server.sh](setup-sync-server.sh)
* **Script cài đặt nhanh trên Windows**: [setup-sync-server.ps1](setup-sync-server.ps1)

---
*Bản quyền thuộc về AntiMini Browser Team. Phát hành theo giấy phép AGPL-3.0.*

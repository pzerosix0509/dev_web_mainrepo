# Restaurantly — Xác Thực Tài Khoản Trên SSR (Block 8)

Ứng dụng web nhà hàng **Restaurantly** xây dựng theo kiến trúc **Server-Side Rendering (SSR)** với **Node.js, Express, EJS, Prisma ORM và PostgreSQL (Supabase)**, triển khai đầy đủ hệ thống xác thực tài khoản và bảo mật theo yêu cầu của **Block 8**:

- **Đăng ký tài khoản (`POST /register`)**: Xác minh thử thách CAPTCHA SVG (`svg-captcha`) tại server trước khi băm mật khẩu (`bcryptjs`), chuẩn hóa email, tạo tài khoản trạng thái `pending` với role mặc định `viewer` (bỏ qua mọi trường `role` gửi từ client), chống dò quét email (User Enumeration).
- **Kích hoạt tài khoản qua OTP (`POST /activate`, `POST /activate/resend`)**: Sinh mã OTP ngẫu nhiên 6 chữ số gửi qua email (`Nodemailer`), chỉ lưu bản băm SHA-256 (`otpHash`) trong bảng `ActivationChallenge`, gắn `purpose = "activation"`, hạn dùng 10 phút, tối đa 5 lần nhập sai. Gửi lại mã mới có thời gian chờ 60 giây, ghi đè `otpHash` cũ nhưng **không** đặt lại bộ đếm `attempts` về 0.
- **Đăng nhập SSR & Chống Brute-force (`POST /login`)**:
  - Theo dõi bộ đếm đăng nhập sai bền vững trong bảng `LoginAttempt` theo email chuẩn hóa và theo IP (cửa sổ 15 phút).
  - Từ **3 lần sai**: Bắt buộc giải đúng thử thách CAPTCHA mới trước bước kiểm tra mật khẩu (giải đúng CAPTCHA không xóa bộ đếm sai).
  - Đủ **10 lần sai theo email** (hoặc 20 lần theo IP): Khóa tạm thời 5 phút, trả về trang **HTTP `429`** ngay cả khi mật khẩu và CAPTCHA đúng.
- **Persistent Session & Cookie (`sid`)**:
  - Phiên đăng nhập lưu bền vững trong bảng `Session` của PostgreSQL (`PrismaSessionStore`). Khởi động lại server không làm mất phiên còn hạn.
  - Cookie `sid` bật `HttpOnly`, `SameSite=Lax`, `Secure` (production); tự động sinh `sid` mới (`req.session.regenerate`) khi đăng nhập để chống Session Fixation.
- **Bảo vệ cụm CRUD & Chống CSRF**:
  - Toàn bộ route của cụm CRUD (`/menu`, `/dishes`, `/admin/dishes`, `/admin/chefs`, `/admin/ingredients`) được bảo vệ bởi middleware `requireAuth` phía server (chưa đăng nhập hoặc tài khoản `pending` bị chuyển hướng **`303 See Other`** về `/login`).
  - Mọi biểu mẫu thay đổi dữ liệu (`POST`, `PATCH`, `DELETE`) được bảo vệ bằng **Synchronizer CSRF Token (`_csrf`)** kết hợp kiểm tra `Origin` header.
- **Quên & Đặt lại mật khẩu (`POST /forgot`, `GET /reset`, `POST /reset`)**:
  - `POST /forgot` phản hồi cùng nội dung và HTTP `200` cho cả email có và không có trong hệ thống; áp dụng giới hạn tần suất (vượt ngưỡng trả `429`).
  - `GET /reset?token=...` đặt `Referrer-Policy: no-referrer` và chỉ hiển thị form (không tiêu thụ token).
  - `POST /reset` cập nhật `passwordHash`, đánh dấu `usedAt`, vô hiệu hóa các token cũ và **thu hồi toàn bộ các phiên đăng nhập (`Session`) hiện có của user**.

---

## 1. Chính Sách Bảo Mật Nhóm Công Bố

| Hạng mục | Chính sách áp dụng |
| :--- | :--- |
| **Chuẩn hóa Email** | `trim().toLowerCase()`. Lưu cả bản gốc (`rawEmail`) và bản chuẩn hóa (`email` - duy nhất). |
| **Băm mật khẩu** | `bcryptjs` với `saltRounds = 10`. Quy tắc mật khẩu: tối thiểu 8 ký tự, gồm cả chữ cái và chữ số. |
| **Thử thách CAPTCHA** | Sinh tại server bằng `svg-captcha`, lưu bảng `CaptchaChallenge` (`challengeId`, `answerHash`, `sessionId`, `purpose`, `expiresAt = 5 phút`, `usedAt`). Dùng 1 lần duy nhất. |
| **OTP Kích hoạt** | 6 chữ số ngẫu nhiên, lưu `otpHash` (SHA-256) trong `ActivationChallenge`, hạn **10 phút**, tối đa **5 lần sai**, chờ **60 giây** khi gửi lại, tối đa **5 lần gửi lại**. |
| **Chống Brute-force Login** | Cửa sổ đếm **15 phút** theo email chuẩn hóa và IP. Sai **≥ 3 lần** yêu cầu CAPTCHA; sai **≥ 10 lần** (email) hoặc **≥ 20 lần** (IP) khóa **5 phút** (HTTP `429`). |
| **Persistent Session** | Lưu trong bảng `Session` (`sid`, `userId`, `data`, `expiresAt`) trên PostgreSQL. Thời hạn phiên: 12 giờ. |
| **Chống CSRF** | Synchronizer Token (`_csrf` trong session và form body) + kiểm tra `Origin` cùng host. Từ chối với HTTP `403`. |
| **Reset Password Token** | 32 bytes hex ngẫu nhiên, lưu `tokenHash` (SHA-256) trong `PasswordReset`, hạn **15 phút**, dùng 1 lần (`usedAt`). Đổi mật khẩu xong xóa mọi bản ghi `Session` của `userId`. |

---

## 2. Cài Đặt & Chạy Ứng Dụng

```bash
# 1. Cài đặt dependencies
npm install

# 2. Đồng bộ schema Prisma lên PostgreSQL
npx prisma db push

# 3. Nạp dữ liệu mẫu (Tuỳ chọn)
ALLOW_DESTRUCTIVE_SEED=true npm run prisma:seed

# 4. Khởi chạy server (http://localhost:3000)
npm start
```

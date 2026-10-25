# RULESET: CSR & RESTFUL API ARCHITECTURE GUIDELINES

### RULE 0: CONFIRMATION & SUGGESTION FIRST (Quy tắc giao tiếp tối thượng)
- Tuyệt đối KHÔNG tự ý giả định các thông tin quan trọng bị thiếu (mô hình Database, thư viện Router, kiến trúc thư mục).
- Bắt buộc phải đưa ra các GỢI Ý / ĐỀ XUẤT kèm câu hỏi XÁC NHẬN để người dùng duyệt trước khi triển khai mã nguồn.

### RULE 1: STRICT SEPARATION OF CONCERNS (Ranh giới FE/BE)
- Backend CHỈ trả về JSON data. Không Render HTML, không dùng View Engine (EJS, Pug, Handlebars).
- Frontend (SPA) CHỈ nhận JSON và tự render UI bằng JavaScript. 
- SPA tuyệt đối không chứa thông tin kết nối DB hoặc Secret Keys.

### RULE 2: DATA INTEGRITY & RELATIONSHIPS
- Mọi truy vấn Món ăn (Dishes) trả về cho FE phải liên kết đúng Đầu bếp (Chef) và danh sách Nguyên liệu (Ingredients).
- Bắt buộc kiểm tra ràng buộc khóa ngoại/sự tồn tại của Chef và Ingredients khi Tạo mới/Cập nhật Món ăn.

### RULE 3: BOUNDED ERROR HANDLING (Phân biệt lỗi 200 vs 500)
- Bắt buộc dùng helper function chung để dựng Response (ví dụ: `sendSuccess(res, data)`, `sendError(res, code, message, fields)`).
- Lỗi Nghiệp Vụ (Validate, Not Found) => Status 200 + `{"ok": false, "error": {...}}`.
- Lỗi Kỹ Thuật/Hạ Tầng (DB Connection Down, Syntax Crash) => Quăng lỗi ra bộ xử lý lỗi chung (Global Error Handler) để trả Status 500. KHÔNG bọc try-catch lỗi DB thành `ok: false` status 200.

### RULE 4: API SERVICE CENTRALIZATION & CORS ERROR CATCHING
- Tất cả giao tiếp HTTP giữa SPA và Backend phải thông qua 1 Lớp/Module đóng gói duy nhất (ví dụ: `class ApiService` hoặc `ApiClient`).
- Catch các lỗi kết nối mạng/CORS ở `ApiService` và hiển thị thông báo rõ ràng cho người dùng.

### RULE 5: UI ERROR MAPPING & INPUT FIELD ERRORS
- Dựa vào `error.code` ổn định để map ra câu thông báo tiếng Việt trên UI.
- Tự động lấy các giá trị từ `error.fields` để render câu báo lỗi nằm ngay dưới ô input tương ứng trong Form.

### RULE 6: INPUT SANITIZATION & TYPE STRICTNESS
- Kiểm tra kiểu dữ liệu đầu vào. Nếu client gửi JSON với kiểu sai (vd: `price: "50000"` dạng string thay vì number), coi đó là `VALIDATION_FAILED`.
- Validate ID trước khi truy vấn DB. Tránh để ID không hợp lệ gây lỗi Query Crash ở DB level.

### RULE 7: UI LOADING BLOCKING POLICY
- Mọi async action (Fetch data, Submit Form, Update/Delete) phải có trạng thái `isLoading`.
- Khi `isLoading = true`:
  + Hiện Spinner / Skeleton Screen.
  + Đặt `disabled` cho tất cả Form Buttons / Controls.
  + Hiển thị lớp phủ Pointer-events-none / Overlay để chặn thao tác chuyển router.
# Restaurantly — Block 7: Tìm Kiếm & Phân Trang

Ứng dụng Nhà hàng phát triển theo mô hình **React CSR/SPA + Express REST API + Prisma + PostgreSQL (Supabase)**.

Nâng cấp theo yêu cầu **Block 7 (Day 6 - Tìm kiếm và phân trang)**:
- Cơ sở dữ liệu $\ge 1.000$ món ăn kèm script seed tự động.
- Cấu hình PostgreSQL Full-Text Search (cấu hình `'simple'`) và Fuzzy Search (`pg_trgm` similarity $\ge 0.3$).
- Hỗ trợ 4 chế độ tìm kiếm: `basic`, `advanced`, `fulltext`, `fuzzy`.
- Phân trang Server-side dạng chuẩn: `{ "ok": true, "data": { "items": [], "total", "page", "pageSize" } }`.
- Giao diện hỗ trợ 3 kiểu phân trang: **Số trang (Numbered)**, **Tải thêm (Load More)**, **Cuộn vô tận (Infinite Scroll)**.
- Phân định rõ Client-side Sort/Filter trên dữ liệu đã tải vs Server-side Search toàn cục.
- Đồng bộ URL (`useSearchParams`) khôi phục trạng thái khi Reload/Share link.

---

## Cấu trúc thư mục

- `backend/`: REST API TypeScript/Express, chỉ trả JSON.
- `frontend/`: React/Vite SPA, điều hướng bằng React Router, lớp `ApiService`.
- `database/sql/`:
  - `001..004_*.sql`: Migration quan hệ từ Block 6.
  - `005_block7_search_indexes.sql`: Bật `pg_trgm`, tạo GIN index cho Full-Text Search và Trigram.
- `SPEC.md`: Đặc tả kỹ thuật chi tiết của Block 7.
- `COMPLETION_REPORT.md`: Báo cáo nghiệm thu, giải trình thiết kế và phân tích lỗi.
- `tests/block7.test.js`: Bộ kiểm thử tự động toàn diện.

---

## Chuẩn bị Database

1. Mở **Supabase SQL Editor** và chạy lần lượt:
   - `database/sql/001_add_relationship_columns.sql`
   - `database/sql/002_backfill_existing_data.sql`
   - `database/sql/003_enforce_relationships.sql`
   - `database/sql/004_validation_queries.sql`
   - `database/sql/005_block7_search_indexes.sql` (Kích hoạt `pg_trgm` và GIN indexes cho Block 7).

2. Chạy seed $\ge 1.000$ món ăn vào Database:
   ```powershell
   npm --prefix backend run seed
   ```

---

## Chạy Ứng dụng

### 1. Khởi động Backend API
```powershell
cd backend
npm install
npm run dev
```
Backend chạy tại: `http://localhost:3000` (kiểm tra trạng thái tại `http://localhost:3000/health`).

### 2. Khởi động Frontend SPA
```powershell
cd frontend
npm install
npm run dev
```
Mở trình duyệt tại: `http://localhost:5173`.

### 3. Chạy cả Backend & Frontend đồng thời
Tại thư mục gốc:
```powershell
npm run dev:all
```

---

## Kiểm thử tự động (Automated Testing)

Tại thư mục gốc dự án:
```powershell
npm test
```
Bộ kiểm thử `tests/block7.test.js` kiểm tra toàn bộ 15 tiêu chí nghiệm thu:
1. CORS & Preflight OPTIONS 204.
2. Xử lý lỗi 404 & 400 không có trường `ok`.
3. Phân trang `{ items, total, page, pageSize }`.
4. Trang vượt phạm vi (`page=99`) trả `items: []`.
5. Bắt lỗi `VALIDATION_FAILED` (sai kiểu, `minPrice > maxPrice`, `mode` lạ).
6. Giá trị biên `minPrice=0` và `available=false`.
7. Escape ký tự đặc biệt `100%`, `SQL_`, `!`.
8. Tính tương đương của `basic` và `advanced` khi chỉ có `q`.
9. Full-text Search và Fuzzy Search với ranking điểm giảm dần.
10. GET món ăn chi tiết & NOT_FOUND.
11. POST tạo món ăn & validate body.
12. PATCH cập nhật & DELETE xóa món ăn.
13. CRUD Đầu bếp (Chef).
14. CRUD Nguyên liệu (Ingredient).
15. SPA Deep Link Fallback & Bảo mật không lộ `DATABASE_URL`.

---

## API Tìm kiếm & Phân trang Món ăn

```text
GET /api/dishes?mode=basic|advanced|fulltext|fuzzy&q=&category=&minPrice=&maxPrice=&available=&page=1&pageSize=10
```

- **Thành công:** HTTP 200 + `{ "ok": true, "data": { "items": [...], "total": 1050, "page": 1, "pageSize": 10 } }`.
- **Lỗi nghiệp vụ:** HTTP 200 + `{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "...", "fields": { ... } } }`.
- **Lỗi hệ thống:** HTTP 500 qua Global Error Handler.

# Restaurantly Block6

Ứng dụng đã được chuyển từ SSR sang mô hình **React CSR/SPA + Express REST API + Prisma + PostgreSQL Supabase**.

## Cấu trúc

- `backend/`: REST API TypeScript/Express, chỉ trả JSON.
- `frontend/`: React/Vite SPA, điều hướng bằng React Router.
- `database/sql/`: SQL chạy thủ công trên Supabase SQL Editor.
- `Agents.md`: rules bắt buộc của dự án.

## Chuẩn bị database

1. Mở Supabase SQL Editor.
2. Chạy lần lượt:
   - `database/sql/001_add_relationship_columns.sql`
   - `database/sql/002_backfill_existing_data.sql`
3. Kiểm tra kết quả SELECT cuối file `002`; chỉnh mapping nếu cần và chạy lại phần mapping.
4. Chỉ chạy `003_enforce_relationships.sql` khi không còn Dish có `chefId IS NULL`.
5. Chạy `004_validation_queries.sql` để kiểm tra quan hệ.

Các SQL không reset dữ liệu. Mapping hiện tại dùng tên món/đầu bếp/nguyên liệu từ seed Block5 và có thể chỉnh thủ công.

## Chạy backend

PowerShell:

```powershell
cd D:\Code_lab\WEB\W4\Block6\backend
Copy-Item D:\Code_lab\WEB\W3\Block5\dev_web_w3\.env .env -Force
npm install --include=dev
npx prisma generate
npm run dev
```

Backend chạy tại `http://localhost:3000`; `DATABASE_URL` chỉ tồn tại ở backend.

## Chạy frontend

Mở terminal khác:

```powershell
cd D:\Code_lab\WEB\W4\Block6\frontend
Copy-Item .env.example .env -Force
npm install --include=dev
npm run dev
```

Mở `http://localhost:5173`. Frontend chỉ dùng `VITE_API_BASE_URL`, không chứa connection string database.

## API chính

```text
GET    /api/dishes?q=&category=&available=
GET    /api/dishes/:id
POST   /api/dishes
PATCH  /api/dishes/:id
DELETE /api/dishes/:id

GET    /api/chefs
GET    /api/chefs/:id
POST   /api/chefs
PATCH  /api/chefs/:id
DELETE /api/chefs/:id

GET    /api/ingredients
GET    /api/ingredients/:id
POST   /api/ingredients
PATCH  /api/ingredients/:id
DELETE /api/ingredients/:id
```

Response thành công có dạng `{ "ok": true, "data": ... }`. Lỗi nghiệp vụ dùng HTTP 200 và `{ "ok": false, "error": { "code", "message", "fields" } }`. Lỗi hệ thống dùng HTTP 5xx.

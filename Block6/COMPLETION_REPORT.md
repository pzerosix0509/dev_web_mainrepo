# Completion Report — Restaurantly Block6

## 1. Liên kết dữ liệu

- `Dish.chefId` là khóa ngoại nhiều-một tới `Chef.id`: một Chef có thể phụ trách nhiều Dish, mỗi Dish có một Chef.
- `DishIngredient` là bảng trung gian nhiều-nhiều giữa `Dish` và `Ingredient`, khóa ghép `(dishId, ingredientId)` chống mapping trùng.
- Xóa Dish cascade xóa mapping trung gian; xóa Chef/Ingredient đang được sử dụng bị chặn bằng `RESTRICT` và API trả `CONFLICT`.
- API `GET /api/dishes` và `GET /api/dishes/:id` luôn include Chef và Ingredients.
- SQL không reset database. File `002_backfill_existing_data.sql` dùng mapping thủ công theo tên để người chạy kiểm tra/chỉnh trước khi enforce `chefId NOT NULL`.

## 2. Frontend

- React + Vite + TypeScript CSR/SPA.
- React Router điều hướng các route `/`, `/menu`, `/menu/:id`, `/admin/dishes`, `/admin/chefs`, `/admin/ingredients` mà không reload trang.
- `ApiService` là lớp HTTP duy nhất; component không gọi `fetch` trực tiếp.
- `AppLayout`, Navbar, footer, HomePage, MenuPage, DishDetailPage.
- CRUD admin cho Dish, Chef và Ingredient; form Dish chọn Chef và nhiều Ingredient.
- Có loading overlay chặn tương tác, loading/empty/error state, confirm xóa và field error.
- Error code được map sang thông báo tiếng Việt; lỗi mạng/CORS hiển thị: `Không thể kết nối đến máy chủ API hoặc do lỗi cấu hình CORS`.

## 3. Backend và response

Backend đặt tại `backend/`, dùng TypeScript + Express + Prisma và chỉ trả JSON.

- `GET/POST/PATCH/DELETE /api/dishes` và `/api/dishes/:id`.
- `GET/POST/PATCH/DELETE /api/chefs` và `/api/chefs/:id`.
- `GET/POST/PATCH/DELETE /api/ingredients` và `/api/ingredients/:id`.
- `GET /health` để kiểm tra tiến trình API.

Thành công:

```json
{ "ok": true, "data": {} }
```

Lỗi nghiệp vụ HTTP 200:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Developer-facing message",
    "fields": { "price": "..." }
  }
}
```

## 4. Ba tầng xử lý lỗi

1. **Validation/business:** kiểm tra kiểu JSON, ID, số nguyên, boolean, danh sách ID trước khi truy vấn; lỗi dùng `VALIDATION_FAILED`, `INVALID_ID`, `NOT_FOUND`, `CONFLICT` và HTTP 200.
2. **Frontend mapping:** đọc `error.code`, hiển thị message tiếng Việt và gắn `error.fields[name]` ngay dưới input; null/mảng rỗng có Empty State.
3. **System/technical:** lỗi runtime hoặc database đi qua global error handler, trả HTTP 500 và không lộ stack trace/secret.

## 5. Bảo mật và CORS

- `DATABASE_URL` được tái sử dụng từ `.env` Block5 nhưng chỉ đặt trong `backend/.env`; `.gitignore` loại `.env`.
- Không có biến `VITE_` chứa secret database.
- Response không trả password/token/stack trace.
- CORS backend cho phép `http://localhost:5173`, method `GET, POST, PATCH, DELETE, OPTIONS` và header `Content-Type`.
- GET không body không tự thêm `Content-Type`, giảm preflight không cần thiết.

## 6. Đã kiểm tra

- `backend`: `npx prisma validate` thành công.
- `backend`: `npm run build` thành công.
- `frontend`: `npm run build` thành công.
- Chưa chạy SQL trên Supabase và chưa chạy seed destructive; cần chạy SQL thủ công theo README sau khi kiểm tra mapping thực tế.

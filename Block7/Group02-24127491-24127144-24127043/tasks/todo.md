# Task Tracker: Block 7 Upgrade

- [x] Task 1: Database Migration & Seed Script
  - Acceptance: Có file `005_block7_search_indexes.sql` kích hoạt `pg_trgm`, GIN FTS (`simple`), GIN Trigram. Script `seed.ts` tạo $\ge 1.000$ món ăn hợp lệ kèm `chef` và `ingredients`.
  - Verify: Chạy script seed thử nghiệm hoặc cú pháp `npx tsx prisma/seed.ts` không lỗi; `npx prisma validate` thành công.
  - Files: `database/sql/005_block7_search_indexes.sql`, `backend/prisma/seed.ts`, `backend/package.json`.

- [x] Task 2: Backend Query Validation & Dish Service (4 Search Modes & Pagination)
  - Acceptance: `validateDishQuery` validate và parse `page`, `pageSize`, `mode`, `q`, `category`, `minPrice`, `maxPrice`, `available`. `listDishesPaginated` trả `{ items, total, page, pageSize }` hỗ trợ `basic` (escape ký tự), `advanced` (AND logic), `fulltext` (simple dictionary rank DESC), `fuzzy` (similarity >= 0.3 DESC). Lỗi trả HTTP 200 `VALIDATION_FAILED`.
  - Verify: Chạy thử controller với các bộ tham số hợp lệ và bất hợp lệ.
  - Files: `backend/src/shared/validation.ts`, `backend/src/modules/dishes/dish.validation.ts`, `backend/src/modules/dishes/dish.service.ts`, `backend/src/modules/dishes/dish.controller.ts`.

- [x] Task 3: Comprehensive Automated Testing Suite
  - Acceptance: Bộ test `tests/block7.test.js` kiểm tra đầy đủ: cấu trúc phân trang, `items: []` khi trang vượt quá, `VALIDATION_FAILED` (sai kiểu, `minPrice > maxPrice`), escape `%`, `_`, `!`, tính tương đương `basic` và `advanced` khi chỉ có `q`, giá trị `minPrice=0` và `available=false`, thứ tự ranking FTS/fuzzy, và giữ nguyên toàn bộ test của Block 6.
  - Verify: `npm test` chạy thành công toàn bộ test suites.
  - Files: `tests/block7.test.js`, `package.json`.

- [x] Task 4: Frontend Types & ApiService Centralization
  - Acceptance: `types/api.ts` có `PaginatedData<T>`, `DishQueryParams`, `PaginationUiMode`. `ApiService.dishes` trả về `PaginatedData<Dish>`.
  - Verify: TypeScript check `npm --prefix frontend run build` không lỗi type.
  - Files: `frontend/src/types/api.ts`, `frontend/src/services/apiService.ts`.

- [x] Task 5: Frontend 3-in-1 Pagination, Search Modes, Client/Server Sort & Filter
  - Acceptance: `MenuPage.tsx` có thanh tìm kiếm với 4 search mode, bộ lọc nâng cao, nút chuyển đổi 3 chế độ phân trang (*Số trang*, *Tải thêm*, *Cuộn vô tận* với `IntersectionObserver`), bộ lọc/sắp xếp Client-side với nhãn thể hiện phạm vi, hủy request cũ qua `AbortController`, đồng bộ URL. `DishesPage.tsx` quản trị có phân trang.
  - Verify: Build frontend thành công, các tương tác UI hoạt động chuẩn xác không lỗi console.
  - Files: `frontend/src/components/PaginationControls.tsx`, `frontend/src/features/menu/MenuPage.tsx`, `frontend/src/features/admin/DishesPage.tsx`, `frontend/src/styles.css`.

- [x] Task 6: Final Verification, Build Checks & Completion Report
  - Acceptance: `npm test` pass 100%, `npm --prefix backend run build` và `npm --prefix frontend run build` pass, `COMPLETION_REPORT.md` cập nhật chi tiết các giải trình thiết kế và bằng chứng sửa lỗi.
  - Verify: Toàn bộ lệnh build và test vượt qua.
  - Files: `COMPLETION_REPORT.md`, `README.md`.

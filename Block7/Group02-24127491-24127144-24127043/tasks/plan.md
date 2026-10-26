# Implementation Plan: Nâng cấp Block 7 (Tìm kiếm & Phân trang)

## 1. Overview & Architecture Strategy
Nâng cấp toàn diện ứng dụng Nhà hàng (Group 02) để đáp ứng trọn vẹn yêu cầu Block 7:
- Database: GIN Full-text Search index, GIN Trigram index (`pg_trgm`), và script seed $\ge 1.000$ món ăn thực tế.
- Backend: Endpoint `GET /api/dishes` chuẩn hóa cấu trúc phân trang `{ items, total, page, pageSize }`, hỗ trợ 4 search mode (`basic`, `advanced`, `fulltext`, `fuzzy`), parameter binding chống SQL injection, escape ký tự đặc biệt, validate chặt chẽ.
- Frontend: Cung cấp đầy đủ 3 kiểu hiển thị phân trang (`numbered`, `load-more`, `infinite`), phân định rành mạch Client-side Sort/Filter vs Server-side Search, đồng bộ URL qua `useSearchParams`.
- Verification: Suite kiểm thử tự động `tests/block7.test.js` kiểm tra toàn bộ ca biên và hồi quy Block 6, hoàn thiện `COMPLETION_REPORT.md`.

## 2. Dependencies & Build Order
```text
Task 1: Database SQL & Seed Script (005_block7_search_indexes.sql, backend/prisma/seed.ts)
   ↓
Task 2: Backend Query Validation & Search Service (shared/validation.ts, dish.validation.ts, dish.service.ts, dish.controller.ts)
   ↓
Task 3: Automated Testing Suite (tests/block7.test.js, mock db, test cases)
   ↓
Task 4: Frontend API & Types (types/api.ts, services/apiService.ts)
   ↓
Task 5: Frontend Pagination & Search UI (PaginationControls.tsx, MenuPage.tsx, DishesPage.tsx, styles.css)
   ↓
Task 6: Verification, Build Checks & Completion Report (npm test, npm run build, COMPLETION_REPORT.md)
```

## 3. Risks & Mitigations
- **Risk:** Prisma ORM không hỗ trợ native `pg_trgm` similarity và complex FTS rank trực tiếp qua API high-level `findMany`.
  - **Mitigation:** Dùng `prisma.$queryRaw` với parameterized query (`Prisma.sql`) cho `fulltext` và `fuzzy`, kết hợp join hoặc fetch IDs rồi đính kèm quan hệ `chef` và `ingredients` đảm bảo thứ tự xếp hạng và an toàn SQL injection.
- **Risk:** `Load More` và `Infinite Scroll` bị trộn lẫn kết quả của 2 lần tìm kiếm khác nhau khi mạng chậm.
  - **Mitigation:** Sử dụng `AbortController` hủy bỏ request cũ ngay khi query thay đổi, và reset mảng danh sách về rỗng trước khi load query mới.
- **Risk:** Các ký tự đặc biệt `%`, `_`, `!` trong search input làm sai lệch câu query `ILIKE`.
  - **Mitigation:** Áp dụng hàm `escapeLikePattern` thay thế `!` thành `!!`, `%` thành `!%`, `_` thành `!_`, và chỉ định `ESCAPE '!'`.

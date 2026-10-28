# Spec: Nâng cấp Ứng dụng Nhà hàng Restaurantly — Block 7 (Tìm kiếm & Phân trang)

## Objective

Nâng cấp dự án **Restaurantly (Group 02)** từ kiến trúc CSR + REST API của Block 6 lên đáp ứng đầy đủ các yêu cầu nghiệp vụ và kỹ thuật của **Block 7 (Day 6 — Tìm kiếm và Phân trang)**:

1. **Dữ liệu & Cấu hình PostgreSQL (Supabase):**
   - Lưu trữ tối thiểu **1.000 món ăn** (`Dish`) có liên kết hợp lệ với `Chef` và `Ingredient` (giữ nguyên tính toàn vẹn dữ liệu của Block 6).
   - Cung cấp script seed tự động tạo lại $\ge 1.000$ món ăn mà không làm hỏng chức năng CRUD hiện có.
   - Bật extension `pg_trgm` phục vụ Fuzzy Search với ngưỡng tương đồng công bố `0.3`.
   - Cấu hình PostgreSQL Full-Text Search sử dụng cấu hình `'simple'` đồng nhất cho cả tài liệu (`coalesce(name, '') || ' ' || coalesce(description, '')`) và truy vấn, kèm GIN index tối ưu hiệu năng.

2. **Server-side Search & Pagination API (`GET /api/dishes`):**
   - Trả về cấu trúc phân trang chuẩn: `{ "ok": true, "data": { "items": [...], "total": 1000, "page": 1, "pageSize": 10 } }`. Mỗi phần tử trong `items` vẫn đính kèm đầy đủ `chef` và `ingredients`.
   - Hỗ trợ 4 chế độ tìm kiếm (`mode`):
     - `basic`: Tìm một phần tên món (`name ILIKE $1 ESCAPE '!'`), không phân biệt hoa/thường, bắt buộc escape ký tự đặc biệt (`!`, `%`, `_`).
     - `advanced`: Kết hợp `q` (cùng quy tắc so khớp tên như `basic`), `category`, `minPrice`, `maxPrice`, `available` bằng toán tử `AND`. Khi chỉ truyền cùng `q`, `basic` và `advanced` phải trả cùng tập kết quả.
     - `fulltext`: Tìm trên cả `name` và `description` bằng PostgreSQL Full-Text Search (`to_tsvector('simple', ...)` và `plainto_tsquery('simple', ...)`), sắp xếp theo điểm `ts_rank` giảm dần, nếu bằng điểm thì xếp theo `id ASC`.
     - `fuzzy`: Tìm tên gần giống bằng `pg_trgm` với ngưỡng `similarity(name, q) >= 0.3`, sắp xếp theo điểm `similarity` giảm dần, nếu bằng điểm thì xếp theo `id ASC`.
   - Kiểm tra hợp lệ (Validation) nghiêm ngặt cho query params:
     - `page` (mặc định `1`, số nguyên dương $\ge 1$; vượt phạm vi vẫn hợp lệ và trả `items: []`).
     - `pageSize` (mặc định `10`, số nguyên dương $1 \le \text{pageSize} \le 100$).
     - `minPrice`, `maxPrice` (số nguyên không âm $\ge 0$; `minPrice=0` là cận hợp lệ; nếu sai định dạng hoặc `minPrice > maxPrice` trả HTTP 200 kèm `ok: false, error.code = "VALIDATION_FAILED"`).
     - `available` (`"true"` hoặc `"false"`; `available=false` chỉ lấy món ngừng bán; giá trị khác trả `VALIDATION_FAILED`).
     - Chuỗi rỗng hoặc chỉ chứa khoảng trắng được chuẩn hóa thành không có tiêu chí (`undefined`).

3. **Ba kiểu hiển thị Phân trang & Phân định phạm vi Client-side vs Server-side:**
   - Hỗ trợ đủ 3 kiểu giao diện phân trang dùng chung API:
     1. **Số trang (Numbered Pagination):** Chọn trang để thay thế danh sách đang xem.
     2. **Tải thêm (Load More):** Bấm nút *"Tải thêm"* để nối `data.items` vào danh sách tích lũy, quản lý trạng thái `nextPage`, `pending`, `end` (`page * pageSize >= total` hoặc `items.length === 0`).
     3. **Cuộn vô tận (Infinite Scroll):** Dùng `IntersectionObserver` (`rootMargin: "200px 0px"`) gắn vào một phần tử `sentinel` đặt cuối danh sách, tự động gọi `loadNext()` khi chưa `pending`/`end` và `disconnect()` khi unmount.
   - **Phân định rõ phạm vi dữ liệu cho Filter & Sort:**
     - **Trang Thực đơn (`/dishes`, `/menu`):** Dùng **Server-side Search & Pagination (AJAX)** kết hợp **Client-side Filter & Sort trên tập dữ liệu đã tải** (hoặc chế độ chuyển đổi rõ ràng kèm nhãn hiển thị phạm vi tác động: *"Đang lọc/sắp xếp trên X món đã tải tại trình duyệt"* vs *"Tìm kiếm trên toàn bộ Y món tại Server"*).
     - **Trang Quản trị món ăn (`/admin/dishes`):** Hỗ trợ phân trang và sắp xếp tên/giá rõ ràng để quản lý danh sách $> 1.000$ món ăn hiệu quả.

4. **Đồng bộ URL & Khôi phục trạng thái:**
   - Đồng bộ các tham số (`mode`, `q`, `category`, `minPrice`, `maxPrice`, `available`, `page`, `pageSize`, `sort`, `uiMode`) lên URL query string.
   - Copy URL sang tab mới, Reload hoặc bấm Back/Forward khôi phục đúng điều kiện và trang đang xem.
   - Khi tìm kiếm lại, đổi filter hoặc đổi sort: tự động đưa về trang 1 (`page=1`), xóa danh sách tích lũy cũ và hủy request đang chạy (`AbortController`) để không trộn lẫn kết quả của hai lần tìm kiếm.

## Tech Stack

- **Backend:** Node.js (ESM), Express `^4.19.2`, TypeScript `^5.5.4`, Prisma `^5.14.0` (`@prisma/client` + `$queryRaw` / parameterized SQL cho FTS & `pg_trgm`), `cors`, `dotenv`.
- **Database:** PostgreSQL trên Supabase (kích hoạt extension `pg_trgm`, GIN index cho Full-Text Search `simple` và Trigram).
- **Frontend:** React `^18.3.1`, React Router DOM `^6.26.2`, TypeScript `^5.5.4`, Vite `^5.4.2`.
- **Testing:** Node HTTP runner với `tsx` (`tests/block6.test.js` mở rộng lên `tests/block7.test.js`).

## Commands

```powershell
# Chạy toàn bộ test tự động
npm test

# Chạy seed >= 1.000 món ăn vào database
npm --prefix backend run seed

# Chạy môi trường phát triển (Backend: 3000, Frontend: 5173)
npm run dev:all

# Kiểm tra Prisma schema & Build kiểm tra kiểu TypeScript
npm --prefix backend run prisma:validate
npm --prefix backend run build
npm --prefix frontend run build
```

## Project Structure

```text
Group02-24127491-24127144-24127043/
├── Agents.md                        → Quy tắc kiến trúc bắt buộc (RULE 0 - RULE 7)
├── SPEC.md                          → Tài liệu đặc tả kỹ thuật Block 7 (file này)
├── COMPLETION_REPORT.md             → Báo cáo nghiệm thu, giải trình thiết kế & bug log
├── database/
│   └── sql/
│       ├── 001..004_*.sql           → Migration quan hệ từ Block 6
│       └── 005_block7_search_indexes.sql → Bật pg_trgm, tạo GIN index FTS ('simple') & trigram
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            → Prisma schema (Dish, Chef, Ingredient, DishIngredient)
│   │   └── seed.ts                  → Script seed >= 1.000 món ăn thực tế
│   └── src/
│       ├── shared/
│       │   ├── response.ts          → sendSuccess, sendBusinessError
│       │   └── validation.ts        → Helper validate body & query params
│       └── modules/dishes/
│           ├── dish.validation.ts   → Validate body CRUD & query params search/pagination
│           ├── dish.service.ts      → Xử lý 4 mode search (basic, advanced, fulltext, fuzzy) & paging
│           └── dish.controller.ts   → Controller GET/POST/PATCH/DELETE /api/dishes
├── frontend/
│   └── src/
│       ├── types/api.ts             → Kiểu PaginatedData<Dish>, DishSearchParams, PaginationUiMode
│       ├── services/apiService.ts   → Lớp giao tiếp HTTP duy nhất (ApiService)
│       ├── components/
│       │   └── PaginationControls.tsx → UI Số trang, Load More và Infinite Scroll sentinel
│       └── features/
│           ├── menu/MenuPage.tsx    → Trang thực đơn: Search (4 mode), 3 kiểu phân trang, Client sort/filter
│           └── admin/DishesPage.tsx → Trang quản trị món ăn có phân trang & sắp xếp
└── tests/
    ├── block6.test.js               → Bộ test hồi quy CRUD & Error handling của Block 6
    └── block7.test.js               → Bộ test nghiệm thu Search, Pagination, Validation của Block 7
```

## Code Style

Tuân thủ tuyệt đối `Agents.md` (nghiêm cấm nối chuỗi SQL trực tiếp, mọi lỗi nghiệp vụ trả HTTP 200 kèm `ok: false`, chỉ dùng 1 lớp `ApiService` ở Frontend):

```typescript
// Ví dụ chuẩn hóa & escape ký tự đặc biệt cho ILIKE (Slide 25)
export function escapeLikePattern(input: string): string {
  return `%${input.replace(/[!%_]/g, '!$&')}%`;
}

// Ví dụ cấu trúc trả về phân trang chuẩn (Slide 9)
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

## Testing Strategy

- **Automated Integration Tests (`tests/block7.test.js` & `tests/block6.test.js`):**
  - Kiểm thử `page`, `pageSize`, `total` và trường hợp trang vượt phạm vi trả `items: []`.
  - Kiểm thử `VALIDATION_FAILED` (HTTP 200, `ok: false`) khi `page <= 0`, `pageSize > 100`, `minPrice < 0`, `minPrice > maxPrice`, `available` khác `true/false`, hoặc `mode` không hợp lệ.
  - Kiểm thử bảo mật: người dùng nhập `100%`, `SQL_`, `!` không làm mở rộng phạm vi tìm kiếm.
  - Kiểm thử `minPrice=0` và `available=false` hoạt động đúng, không bị bỏ qua như giá trị rỗng.
  - Kiểm thử `basic` và `advanced` cho cùng kết quả khi chỉ có cùng `q`.
  - Kiểm thử giữ nguyên toàn bộ test CRUD, quan hệ `Chef`/`Ingredient` và CORS từ `block6.test.js`.
- **Database Verification (`database/sql/005_block7_search_indexes.sql`):**
  - Kiểm tra số lượng bản ghi `SELECT COUNT(*) FROM "Dish"` $\ge 1000$.
  - Kiểm tra truy vấn `fulltext` (`simple`) và `fuzzy` (`pg_trgm` với ngưỡng `0.3`) trên PostgreSQL thực tế.

## Boundaries

- **Always do:**
  - Tuân thủ 7 quy tắc trong `Agents.md` (Strict Separation of Concerns, Data Integrity, Bounded Error Handling 200 vs 500, ApiService Centralization, UI Error Mapping, Input Sanitization, UI Loading Blocking).
  - Dùng Parameter Binding (`$1, $2...` hoặc `Prisma.sql`), tuyệt đối không nối chuỗi input vào câu SQL.
  - Giữ đầy đủ thông tin `chef` và `ingredients` trong mỗi món ăn trả về từ `GET /api/dishes`.
  - Chạy `npm test` và `npm run build` ở cả `backend` và `frontend` trước khi hoàn tất mỗi bước.
- **Ask first:**
  - Thay đổi cấu trúc bảng trong `schema.prisma` gây ảnh hưởng đến dữ liệu hiện có.
  - Cài đặt thêm thư viện ngoài (`dependencies`) mới vào `package.json`.
  - Chạy lệnh xóa trắng (truncate/reset) dữ liệu trên Supabase production.
- **Never do:**
  - Để lộ `DATABASE_URL` hoặc khóa bí mật ở phía `frontend/`.
  - Trả về HTTP 400/422 cho lỗi `VALIDATION_FAILED` nghiệp vụ (bắt buộc trả HTTP 200 + `ok: false` theo Slide 10 và `Agents.md` RULE 3).
  - Trộn kết quả của hai lần tìm kiếm khác nhau khi dùng `Load More` hoặc `Infinite Scroll`.

## Success Criteria

- [ ] Database Supabase có ít nhất **1.000 món ăn** và script `backend/prisma/seed.ts` chạy tạo lại dữ liệu thành công.
- [ ] `GET /api/dishes` trả về `{ ok: true, data: { items, total, page, pageSize } }` và hỗ trợ đầy đủ 4 chế độ `mode=basic|advanced|fulltext|fuzzy`.
- [ ] Cấu hình PostgreSQL dùng đúng dictionary `'simple'` cho Full-Text Search (cả `name` và `description`, xử lý `NULL`) và `pg_trgm` với ngưỡng `0.3` cho Fuzzy Search; sắp xếp theo điểm giảm dần kèm `id ASC` khi bằng điểm.
- [ ] Giao diện hỗ trợ đủ **3 kiểu phân trang** (Số trang, Load More, Infinite Scroll) trên cùng một API, không mất món hoặc lặp món.
- [ ] Bộ Filter & Sort hoạt động đúng phạm vi dữ liệu đã công bố (nêu rõ trên UI và báo cáo).
- [ ] Copy URL hoặc Reload giữ nguyên điều kiện tìm kiếm và số trang; đổi từ khóa/filter/sort tự động quay về trang 1; công bố rõ hành vi mở lại link của Load More / Infinite Scroll.
- [ ] Bộ kiểm thử tự động (`npm test`) và quá trình build (`backend` + `frontend`) vượt qua 100%.
- [ ] Tài liệu `COMPLETION_REPORT.md` ghi rõ các quyết định thiết kế của nhóm và ít nhất 1 lỗi đã phát hiện, cách tái hiện cùng bằng chứng sau khi sửa.

## Open Questions

1. **Tổ chức giao diện 3 kiểu phân trang (UI Mode):** Nhóm muốn đặt bộ chuyển đổi 3 chế độ hiển thị (*Số trang / Load More / Infinite Scroll*) ngay trên trang **Thực đơn (`/dishes`)** (để giảng viên dễ kiểm thử cả 3 kiểu trên cùng một màn hình), hay tách riêng từng kiểu cho từng trang (ví dụ: `/dishes` dùng *Số trang + Chuyển đổi Load More/Infinite Scroll*, còn `/admin/dishes` cố định *Số trang*)?
2. **Phạm vi Filter & Sort (Client-side vs Server-side):**
   - **Đề xuất:**
     - Tại **Server (`/api/dishes`)**: Xử lý tìm kiếm (`basic`, `advanced`, `fulltext`, `fuzzy`) và lọc toàn cục (`category`, `minPrice`, `maxPrice`, `available`).
     - Tại **Client (Trình duyệt)**: Trên trang `/dishes`, bổ sung thanh **Sắp xếp & Lọc nhanh trên các món đã tải** (ví dụ: sắp xếp giá tăng/giảm, tên A-Z, lọc nhanh trên các món đang hiển thị ở trang hiện tại/danh sách đã tích lũy) kèm chú thích rõ *"Tác động trên X món đã tải về trình duyệt"* để chứng minh trực quan sự khác biệt giữa Client-side và Server-side theo đúng câu hỏi xuyên suốt của bài giảng (Slide 3, 19, 36). Nhóm có đồng ý với phương án này không, hay muốn thêm cả tham số `sort` tại Server cho trang Admin?
3. **Hành vi khi mở lại link (Reload / Copy URL) ở chế độ `Load More` và `Infinite Scroll` (Slide 39):**
   - **Đề xuất:** Khi đang ở `Load More` hoặc `Infinite Scroll`, nếu người dùng Reload hoặc mở lại link, ứng dụng sẽ **tải lại từ trang 1 (`page=1`)** với đúng bộ điều kiện tìm kiếm trên URL (và ghi rõ quy ước này trên giao diện cũng như trong báo cáo nghiệm thu), trong khi chế độ **Số trang (`numbered`)** sẽ khôi phục chính xác trang `page=N` trên URL. Nhóm xác nhận chọn cách này hay muốn tự động tải lại toàn bộ các trang từ `1..N`?

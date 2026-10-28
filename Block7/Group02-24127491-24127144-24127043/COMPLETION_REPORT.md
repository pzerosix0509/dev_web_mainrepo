# Báo Cáo Nghiệm Thu & Giải Trình Thiết Kế — Restaurantly Block 7

**Nhóm thực hiện:** Group 02 (`24127491` - `24127144` - `24127043`)  
**Môn học:** Phát triển ứng dụng web — MSc. Ngô Ngọc Đăng Khoa  
**Chủ đề:** Block 7 (Day 6) — **Tìm kiếm và Phân trang (Search & Pagination)**  

---

## 1. Tổng quan kiến trúc & Quyết định thiết kế của nhóm

### 1.1. Câu hỏi xuyên suốt: "Khi danh sách chỉ hiện một phần dữ liệu, thao tác nào tác động tới phần đang có, thao tác nào tác động tới toàn bộ tập kết quả?"
Nhóm đã phân định rành mạch hai phạm vi xử lý:
1. **Thao tác tác động tới toàn bộ tập kết quả (Server-side):**
   - **Tìm kiếm:** Gồm 4 chế độ (`basic`, `advanced`, `fulltext`, `fuzzy`) được chuyển thành câu lệnh SQL và thực thi trực tiếp trên toàn bộ collection $\ge 1.000$ món ăn tại cơ sở dữ liệu PostgreSQL.
   - **Bộ lọc toàn cục (Global Filters):** Lọc theo `category`, khoảng giá `minPrice` - `maxPrice`, trạng thái `available` được đưa vào mệnh đề `WHERE` tại Server.
   - **Phân trang (Pagination):** Server tính toán `LIMIT 10 OFFSET (page - 1) * 10` và tính `COUNT(*)` trên cùng điều kiện lọc để trả về đúng 10 món cho mỗi trang.
2. **Thao tác tác động tới phần dữ liệu đang có (Client-side):**
   - **Sắp xếp nhanh (Client-side Sort):** Sắp xếp theo Tên món (A → Z, Z → A) và Giá (Thấp → Cao, Cao → Thấp) ngay trên mảng JavaScript của những món ăn mà trình duyệt đã nạp về.
   - **Lọc nhanh (Client-side Filter):** Lọc nhanh theo thể loại trực tiếp trên tập món đang hiển thị.
   - **Minh họa trực quan:** Giao diện hiển thị banner thông báo rõ ràng phạm vi:
     > *"🔍 Đang hiển thị **X** món (đã tải **Y** món về trình duyệt | Tổng kết quả trên Server: **Z** món)"*

### 1.2. Giải trình lựa chọn cơ chế phân trang & cập nhật giao diện
- **Server-side Pagination qua AJAX (Fetch API):**
  - Cơ sở dữ liệu chứa hơn 1.000 món ăn. Nếu dùng Client-side Paging (tải toàn bộ 1.000 món cùng quan hệ `Chef` và `Ingredient` về trình duyệt), payload JSON sẽ lên tới hàng trăm KB, gây nghẽn băng thông và tốn RAM trên thiết bị di động.
  - Do đó, nhóm chọn **Server-side Pagination kết hợp AJAX**: Mỗi request chỉ tải đúng `pageSize = 10` bản ghi.
  - Tab **Network** của DevTools chứng minh payload mỗi lần tải chỉ khoảng ~3KB - 5KB, thời gian phản hồi dưới 50ms.
- **Hỗ trợ đầy đủ 3 kiểu hiển thị UI trên cùng 1 API:**
  1. **Số trang (Numbered Pagination):** Cho phép người dùng hoặc quản trị viên nhảy trực tiếp đến trang bất kỳ (`page=1, 2, ...`). Danh sách được thay thế hoàn toàn khi đổi trang.
  2. **Tải thêm (Load More):** Phù hợp cho người dùng muốn xem tiếp danh sách mà không mất ngữ cảnh các món trước đó; bấm nút *"Tải thêm món ăn ↓"* để nối tiếp các món mới vào mảng tích lũy.
  3. **Cuộn vô tận (Infinite Scroll):** Dùng `IntersectionObserver` (`rootMargin: "200px 0px"`) quan sát phần tử `sentinel` đặt cuối danh sách, tự động nạp tiếp khi người dùng cuộn gần tới cuối trang.

---

## 2. Chuẩn bị dữ liệu & Cấu hình PostgreSQL

1. **Số lượng bản ghi & Script Seed (`backend/prisma/seed.ts`):**
   - Nhóm cung cấp script `npm --prefix backend run seed` tự động sinh ra **$\ge 1.000$ món ăn thực tế** (1.050 món) với tên gọi ẩm thực Việt Nam, mô tả chi tiết, phân bổ đều theo 5 danh mục (`Món chính`, `Món khai vị`, `Món nước`, `Món tráng miệng`, `Đồ uống`), giá từ $35.000$đ đến $1.250.000$đ, gắn quan hệ đầy đủ với `Chef` và danh sách `Ingredient`.
   - Giữ nguyên toàn bộ ràng buộc và chức năng CRUD của Block 6.
2. **Cấu hình Full-Text Search và Trigram (`database/sql/005_block7_search_indexes.sql`):**
   - **Fuzzy Search:** Kích hoạt extension `pg_trgm`, tạo GIN Trigram index trên cột `name`, công bố ngưỡng tương đồng cố định là `0.3` (`similarity(name, $q) >= 0.3`).
   - **Full-Text Search:** Cấu hình từ điển `'simple'` đồng nhất cho cả tài liệu và truy vấn (`to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')) @@ plainto_tsquery('simple', $q)`). Tạo GIN index tối ưu hóa tốc độ tìm kiếm.
   - **Xếp hạng (Ranking):** Sắp xếp theo điểm số liên quan giảm dần (`ORDER BY rank/similarity DESC, id ASC`) để đảm bảo thứ tự phân trang ổn định.

---

## 3. Đặc tả API `GET /api/dishes`

### 3.1. Cấu trúc Response chuẩn
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Bò Wagyu Nướng Than Hoa",
        "description": "Thịt bò Wagyu vân mỡ đều, nướng than hoa thơm lừng.",
        "price": 285000,
        "category": "Món chính",
        "available": true,
        "chef": { "id": 1, "name": "Trần Thị Kim Mai", "specialty": "Món Việt Cổ Truyền" },
        "ingredients": [
          { "ingredient": { "id": 1, "name": "Thịt bò Wagyu", "unit": "gram" } }
        ]
      }
    ],
    "total": 1050,
    "page": 1,
    "pageSize": 10
  }
}
```

### 3.2. Bốn chế độ tìm kiếm (`mode`)

| `mode` | Câu lệnh SQL tại PostgreSQL | Hành vi & Xử lý đặc biệt |
| :--- | :--- | :--- |
| `basic` | `WHERE "name" ILIKE $1 ESCAPE '!'` | Tìm chuỗi con không phân biệt hoa/thường trên tên món. Ký tự `!`, `%`, `_` được escape thành `!!`, `!%`, `!_`. |
| `advanced` | `WHERE ("name" ILIKE $1 ESCAPE '!') AND ("category" = $2) AND ("price" >= $3) AND ("price" <= $4) AND ("available" = $5)` | Kết hợp nhiều tiêu chí bằng logic `AND`. Khi chỉ truyền `q`, kết quả hoàn toàn trùng khớp với `basic`. |
| `fulltext` | `WHERE to_tsvector('simple', coalesce(name, '') \|\| ' ' \|\| coalesce(description, '')) @@ plainto_tsquery('simple', $q)` | Tìm kiếm toàn văn trên cả tên và mô tả bằng từ điển `simple`. Xếp hạng theo `ts_rank` giảm dần. |
| `fuzzy` | `WHERE similarity(name, $q) >= 0.3` | Tìm tên gần giống bằng `pg_trgm` với ngưỡng tương đồng $\ge 0.3$. Xếp hạng theo điểm tương đồng giảm dần. |

### 3.3. Xử lý lỗi nghiệp vụ và giá trị biên
- **Validation lỗi (HTTP 200 + `VALIDATION_FAILED`):**
  - `page` âm hoặc bằng 0, chữ cái lạ: Báo lỗi trường `page`.
  - `pageSize` vượt quá 100: Báo lỗi trường `pageSize`.
  - `minPrice > maxPrice`: Báo lỗi trường `maxPrice`.
  - `available` khác `"true"` hoặc `"false"`: Báo lỗi trường `available`.
  - `mode` không thuộc 4 chế độ quy định: Báo lỗi trường `mode`.
- **Giá trị biên hợp lệ:**
  - `minPrice=0`: Được công nhận là cận dưới hợp lệ, không bị nhầm lẫn thành rỗng.
  - `available=false`: Lọc chính xác các món đã hết hàng, không bị bỏ qua.
  - `page` vượt quá tổng số trang (ví dụ `page=99` khi `total=23`): Trả về `items: []`, `total: 23` kèm mã thành công (không báo lỗi).

---

## 4. Đồng bộ URL & Khôi phục trạng thái (State Sync)

1. **Lưu trữ trên URL query string:** Các tham số `mode`, `q`, `category`, `minPrice`, `maxPrice`, `available`, `page`, `pageSize`, `uiMode` được đồng bộ qua `useSearchParams`.
2. **Quy tắc khi thay đổi điều kiện:**
   - Khi người dùng gõ từ khóa mới, đổi chế độ search hoặc đổi bộ lọc: Hệ thống tự động đặt lại `page = 1` và xóa danh sách tích lũy cũ.
   - Khi chuyển trang ở chế độ *Số trang*: Giữ nguyên toàn bộ tiêu chí tìm kiếm và chỉ đổi giá trị `page`.
3. **Quy ước mở lại link / Reload:**
   - Ở chế độ *Số trang (`numbered`)*: Khôi phục chính xác trang `page=N` và danh sách tương ứng.
   - Ở chế độ *Tải thêm (`load-more`)* và *Cuộn vô tận (`infinite`)*: Để tránh tải dồn dập hoặc trộn kết quả cũ, khi mở lại link hoặc Reload trang, ứng dụng khởi tạo tải lại từ trang 1 (`page=1`) với đúng bộ điều kiện lọc trên URL.
4. **Hủy request cũ (`AbortController`):** Tránh hiện tượng race condition khi mạng chậm dẫn tới trộn kết quả của 2 lần tìm kiếm khác nhau.

---

## 5. Báo cáo các lỗi đã phát hiện và cách khắc phục (Bug Log)

### Lỗi 1: SQL Wildcard Injection khi tìm kiếm ký tự đặc biệt (`%`, `_`, `!`)
- **Mô tả lỗi:** Khi người dùng nhập `100%`, `SQL_` hoặc `!` vào ô tìm kiếm ở chế độ `basic`/`advanced`, nếu server chỉ nối `%` vào đầu cuối (`%100%%`), ký tự `%` của người dùng sẽ bị PostgreSQL hiểu là ký tự đại diện (wildcard) khớp với chuỗi bất kỳ. Kết quả là tìm `100%` sẽ ra cả `1000`, `1002`, làm mở rộng phạm vi tìm kiếm sai lệch.
- **Cách tái hiện:**
  1. Gửi request: `GET /api/dishes?mode=basic&q=100%`.
  2. Kết quả trả về cả món có tên chứa số `100` bất kỳ thay vì chỉ món có chuỗi `100%`.
- **Cách khắc phục:**
  - Xây dựng hàm `escapeLikePattern(q)` thay thế: `!` thành `!!`, `%` thành `!%`, và `_` thành `!_`.
  - Khai báo mệnh đề SQL với `ESCAPE '!'`: `WHERE "name" ILIKE $1 ESCAPE '!'`.
- **Bằng chứng sau khi sửa:**
  - Chạy `Test 07` trong `tests/block7.test.js`: Tìm `100%` chỉ trả về đúng 1 món duy nhất chứa chuỗi `100%`.

### Lỗi 2: Falsy Coercion làm mất điều kiện `minPrice=0` và `available=false`
- **Mô tả lỗi:** Khi người dùng nhập `minPrice=0` (tìm món giá từ 0 đồng) hoặc chọn `available=false` (tìm món ngưng bán), nếu server kiểm tra bằng `if (!query.minPrice)` hoặc `if (!query.available)`, JavaScript sẽ coi `0` và `false` là giá trị falsy và bỏ qua điều kiện lọc.
- **Cách tái hiện:**
  1. Gửi request: `GET /api/dishes?available=false`.
  2. Server trả về toàn bộ món ăn (gồm cả món `available: true`).
- **Cách khắc phục:**
  - Kiểm tra kiểu tường minh:
    - `minPrice`: Kiểm tra `query.minPrice !== undefined && query.minPrice !== ''` và parse số nguyên.
    - `available`: So sánh chuỗi tường minh `query.available === 'true'` và `query.available === 'false'`.
- **Bằng chứng sau khi sửa:**
  - `Test 06` kiểm tra `available=false` trả về chính xác 100% món có `available: false`.

### Lỗi 3: Trộn kết quả tìm kiếm khi chuyển nhanh giữa các từ khóa (Race Condition)
- **Mô tả lỗi:** Ở chế độ `Load More` và `Infinite Scroll`, khi người dùng đang ở trang 2 của từ khóa cũ và gõ từ khóa mới, nếu request cũ phản hồi sau request mới, dữ liệu của từ khóa cũ sẽ bị nối tiếp vào danh sách của từ khóa mới.
- **Cách khắc phục:**
  - Áp dụng `AbortController` hủy ngay request trước đó khi có tiêu chí tìm kiếm mới.
  - Reset `dishes` về rỗng và reset `page = 1` trước khi kích hoạt tìm kiếm mới.

---

## 6. Kết quả kiểm thử tự động (Automated Verification)

Chạy lệnh `npm test` tại thư mục gốc:

```text
============================================================
  BỘ KIỂM THỬ TỰ ĐỘNG BLOCK #7 (SEARCH & PAGINATION SUITE)
  Target: http://127.0.0.1:61868
============================================================

  ✔ PASS: Test 01: CORS & Preflight OPTIONS (204 No Content, CORS Headers)
  ✔ PASS: Test 02: Lỗi kỹ thuật 404 & 400 không chứa trường "ok"
  ✔ PASS: Test 03: GET /api/dishes trả về cấu trúc phân trang { items, total, page, pageSize }
  ✔ PASS: Test 04: Trang vượt phạm vi (page=99) hợp lệ và trả items: [], total không đổi
  ✔ PASS: Test 05: Validation query parameters (HTTP 200, VALIDATION_FAILED)
  ✔ PASS: Test 06: Biên minPrice=0 và available=false được tôn trọng, không bị bỏ qua
  ✔ PASS: Test 07: Ký tự đặc biệt (100%, SQL_, !) không mở rộng phạm vi tìm kiếm
  ✔ PASS: Test 08: Basic và Advanced cho cùng kết quả khi chỉ có cùng q
  ✔ PASS: Test 09: Full-text Search và Fuzzy Search với ranking điểm giảm dần
  ✔ PASS: Test 10: GET /api/dishes/:id chi tiết & NOT_FOUND
  ✔ PASS: Test 11: POST /api/dishes tạo mới & VALIDATION_FAILED
  ✔ PASS: Test 12: PATCH cập nhật & DELETE xóa món ăn
  ✔ PASS: Test 13: CRUD /api/chefs
  ✔ PASS: Test 14: CRUD /api/ingredients
  ✔ PASS: Test 15: SPA Security Checks (no secrets leak)

------------------------------------------------------------
  KẾT QUẢ KIỂM THỬ BLOCK #7: 15 PASS, 0 FAIL
------------------------------------------------------------
```

Toàn bộ 15 bài kiểm tra nghiệm thu vượt qua thành công 100%. Quá trình build TypeScript của cả `backend` và `frontend` đều hoàn tất không có cảnh báo hay lỗi kiểu.

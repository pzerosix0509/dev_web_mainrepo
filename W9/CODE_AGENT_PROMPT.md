# Prompt triển khai Photo Gallery xử lý ảnh với SeaweedFS

Bạn là coding agent chịu trách nhiệm xây dựng hoàn chỉnh một ứng dụng web Photo Gallery trong thư mục `D:\Code_lab\WEB\W9`. Hãy làm việc trực tiếp trong thư mục này, không chỉ phân tích hoặc viết kế hoạch. Đọc và bảo toàn nội dung hiện có, đặc biệt là `Note.md`; không xóa hay ghi đè thay đổi không liên quan.

Nguồn yêu cầu bài tập là slide 32–42 tại:

`https://pub.nndkhoa9.win/web/week9/block10-photo-gallery-deck.html#32`

Trước khi code, hãy đọc lại các slide 32–42 và dùng chúng làm tiêu chuẩn nghiệm thu. Nếu một quyết định kỹ thuật trong prompt này khác với cách diễn đạt chung trong slide, hãy giữ nguyên mục tiêu nghiệm thu của slide nhưng áp dụng các thay đổi kiến trúc được yêu cầu dưới đây, đặc biệt là thay local filesystem bằng SeaweedFS object storage.

# Mục tiêu sản phẩm

Xây dựng một ứng dụng CSR Photo Gallery dùng chung cho nhiều người truy cập:

- Người dùng upload từ 1 đến 5 ảnh trong một request.
- Server kiểm tra và xử lý độc lập từng file; một file lỗi không làm mất các file hợp lệ khác.
- Ảnh hợp lệ được chuẩn hóa, loại bỏ metadata nhạy cảm và sinh các variant.
- Ảnh cùng metadata được lưu bền vững; file ảnh lưu trong SeaweedFS object storage, không lưu bền vững trên local filesystem.
- Mọi người truy cập gallery có thể nhìn thấy ảnh READY do người khác upload.
- Gallery responsive, có trang chi tiết, zoom phù hợp, thao tác xóa và phần bonus chỉnh sửa ảnh.
- Ứng dụng dùng cache đúng tầng, đồng bộ thay đổi giữa nhiều client và vẫn hoạt động sau khi restart.

Ứng dụng này là public shared gallery phục vụ bài tập. Không dành thời gian xây hệ thống đăng nhập hoàn chỉnh nếu dự án chưa có sẵn authentication. Tuy nhiên, cấu trúc dữ liệu và service nên đủ rõ để có thể thêm `ownerId` hoặc quyền truy cập sau này.

# Stack mặc định

Nếu thư mục chưa có project hoặc chưa có stack bắt buộc, dùng monorepo TypeScript với:

- Frontend: React, Vite, TypeScript, React Router.
- CSR data fetching/cache: TanStack Query.
- Backend API: Node.js, TypeScript, Express hoặc Fastify. Ưu tiên Fastify nếu bắt đầu mới vì hỗ trợ streaming và giới hạn request tốt; không đổi framework nếu project đã có framework phù hợp.
- Database: PostgreSQL.
- ORM/migration: Prisma.
- Cache và event: Redis.
- Object storage: SeaweedFS S3 Gateway, truy cập bằng AWS SDK S3 client với custom endpoint và path-style addressing.
- Image processing: Sharp/libvips.
- Realtime invalidation: Server-Sent Events; chỉ dùng WebSocket nếu project đã có sẵn.
- Local infrastructure: Docker Compose cho PostgreSQL, Redis và SeaweedFS master/volume/filer/S3.
- Local CDN simulation: Nginx reverse proxy cache trước media endpoint nếu hợp lý. Ứng dụng vẫn phải chạy được khi bỏ Nginx; cache header và URL bất biến là yêu cầu cốt lõi.
- Test: Vitest hoặc test runner phù hợp với stack; Playwright cho các luồng UI quan trọng nếu khả thi.

Không dùng Firebase Local Storage, browser `localStorage`, hoặc thư mục upload local làm nơi lưu ảnh bền vững. Local temporary directory chỉ được dùng trong lúc decode, re-encode hoặc sinh tile; phải dọn sau khi hoàn tất hoặc thất bại.

# Kiến trúc bắt buộc

Luồng chính:

```text
React CSR
  ├── TanStack Query cache
  ├── Browser HTTP cache
  └── SSE photo events
          │
          ▼
API server
  ├── Upload validation and orchestration
  ├── Image processor
  ├── Redis metadata/query cache
  ├── PostgreSQL metadata
  └── SeaweedFS S3 client
          │
          ▼
SeaweedFS object storage
          ▲
          │
CDN/Nginx cache hoặc media proxy có cache headers
```

Frontend phải là CSR thực sự:

- `index.html` chỉ là app shell.
- React Router có tối thiểu gallery và trang chi tiết.
- Dữ liệu lấy qua JSON API.
- Không server-render gallery HTML.
- Static JS/CSS có tên hash và cache lâu; `index.html` dùng `no-cache` để nhận bản deploy mới.

# Mô hình dữ liệu

Thiết kế Prisma schema tối thiểu tương đương:

```text
Photo
- id
- originalName
- status: PROCESSING | READY | FAILED | DELETING | DELETED
- detectedMimeType
- width
- height
- altText
- currentVersion
- createdAt
- updatedAt
- deletedAt nullable

PhotoVersion
- id
- photoId
- version
- normalizedOriginalKey
- manifestKey nullable
- createdAt
- publishedAt nullable

PhotoVariant
- id
- photoVersionId
- kind: THUMB | MEDIUM | LARGE | TILE | PREVIEW
- storageKey
- mimeType
- width
- height
- byteSize
- checksum hoặc etag nullable
- tileLevel/tileX/tileY nullable
```

Có thể điều chỉnh schema nhưng phải giữ các nguyên tắc:

- Database chỉ lưu storage key, không lưu absolute filesystem path.
- Không coi URL CDN cố định là nguồn sự thật; URL được tạo từ storage key/config.
- Version mới chỉ được công bố bằng cách cập nhật `currentVersion` sau khi toàn bộ file và metadata đã ghi đủ.
- Có trạng thái để xử lý lỗi và cleanup idempotent.

# Quy tắc upload

Áp dụng các giới hạn rõ ràng và khai báo tập trung trong config:

- Từ 1 đến 5 file mỗi request.
- Tối đa 10 MiB cho mỗi file.
- Tối đa khoảng 55 MiB cho toàn bộ multipart request, gồm overhead.
- Tối đa 8.000 px cho width hoặc height.
- Tối đa 25 megapixel cho `width × height`.
- Chỉ chấp nhận JPEG, PNG và WebP. Nếu Sharp/libvips của môi trường không hỗ trợ WebP đáng tin cậy thì JPEG và PNG là bắt buộc, WebP có thể tắt bằng config.
- Không chấp nhận SVG, GIF động, PDF, archive hoặc định dạng thực thi.
- Phải stream multipart và dừng đọc file khi vượt giới hạn; không buffer toàn bộ request vào RAM.
- Response trả kết quả riêng cho từng file, giữ đúng thứ tự file từ request nếu có thể.
- Khi trộn file hợp lệ và file giả, chỉ file hợp lệ được lưu.

Ví dụ response:

```json
{
  "results": [
    {
      "fileName": "valid.jpg",
      "status": "accepted",
      "photoId": "..."
    },
    {
      "fileName": "fake.jpg",
      "status": "rejected",
      "code": "FILE_CONTENT_TYPE_MISMATCH",
      "message": "Nội dung file không phải ảnh JPEG hợp lệ"
    }
  ]
}
```

Frontend phải kiểm tra sớm số file và dung lượng để UX tốt, nhưng server luôn là nơi quyết định cuối cùng.

# Validate file ảnh nhiều lớp

Không tin tên file, extension hay `Content-Type` do client gửi. Pipeline phải gồm:

1. Kiểm tra count, byte limit và request limit trong multipart parser.
2. Chuẩn hóa tên file chỉ để hiển thị; không dùng tên này làm storage key.
3. Allowlist extension cuối cùng: `.jpg`, `.jpeg`, `.png`, `.webp`.
4. Đối chiếu `Content-Type` khai báo, nhưng coi đây chỉ là tín hiệu không đáng tin cậy.
5. Phát hiện loại file theo chữ ký/nội dung bằng thư viện đáng tin cậy; không chỉ tự so vài byte.
6. Đối chiếu extension, MIME khai báo và MIME phát hiện. Với bài tập này, mismatch phải bị từ chối thay vì tự đổi extension.
7. Đọc metadata có giới hạn, kiểm tra width, height, số pixel và số frame trước khi xử lý nặng.
8. Decode ảnh thật sự bằng Sharp/libvips; file truncated hoặc không decode hoàn chỉnh phải bị từ chối.
9. Auto-orient dựa trên EXIF orientation.
10. Re-encode thành output mới do server kiểm soát; không phục vụ trực tiếp byte gốc người dùng upload.
11. Strip metadata, đặc biệt toàn bộ GPS EXIF, trên normalized original công khai và mọi variant/tile.
12. Tạo storage key bằng UUID/ULID và version; không dùng path từ người dùng.

File EXE đổi tên thành `.jpeg` thường có chữ ký `MZ` và phải bị từ chối. Cũng phải có test cho file chỉ giả magic bytes. Chữ ký file không đủ: bước decode và re-encode là bắt buộc để loại file giả, file polyglot/trailing payload và file ảnh hỏng. Antivirus có thể là lớp bổ sung tùy chọn nhưng không thay thế pipeline trên.

Image processor phải chạy với giới hạn tài nguyên hợp lý: giới hạn pixel, memory/cache, concurrency và timeout. Không bật external delegates hoặc định dạng không cần thiết. Không cho image processor truy cập tùy ý filesystem hoặc network.

# Chuẩn hóa và variant

Mỗi ảnh hợp lệ tạo một normalized original và tối đa ba variant bắt buộc:

- `thumb`: chiều rộng mục tiêu khoảng 320 px.
- `medium`: khoảng 1024 px.
- `large`: khoảng 1920 px.

Không upscale ảnh nhỏ. Giữ aspect ratio. Có thể dùng WebP cho variant nếu được hỗ trợ; normalized original có thể giữ JPEG/PNG tương ứng sau khi re-encode. Tất cả output phải có MIME đúng, width, height và byte size trong database.

Object key phải bất biến và có version, ví dụ:

```text
photos/{photoId}/v1/original.jpg
photos/{photoId}/v1/thumb.webp
photos/{photoId}/v1/medium.webp
photos/{photoId}/v1/large.webp
```

Không ghi đè nội dung tại cùng key. Khi chỉnh sửa, tạo `v2`, sau đó đổi `currentVersion`.

# Cơ chế tải và hiển thị ảnh

Đối với gallery thông thường:

- Dùng thumbnail ở gallery.
- Dùng `srcset` và `sizes` để browser chọn medium/large phù hợp.
- Luôn xuất `width`, `height`, `alt` và `loading="lazy"` trong DOM.
- Dùng placeholder/skeleton hoặc low-quality preview để tránh layout shift và cho cảm giác tải nhanh.
- Không mặc định tải original hoặc variant lớn nhất.

Phân biệt rõ hai khái niệm:

- Multipart/TUS/chunked upload là chia byte để truyền file ổn định; không dùng các byte chunk để hiển thị ảnh.
- Image tile pyramid là chia theo vùng pixel để viewer hiển thị ảnh rất lớn.

Với ảnh có ít nhất 12 megapixel nhưng vẫn nằm trong giới hạn 25 megapixel, triển khai chế độ Deep Zoom như một tính năng bổ sung:

- Sinh pyramid nhiều mức phân giải và tile 256×256 hoặc 512×512 bằng Sharp/libvips Deep Zoom.
- Có thể tạo tile trong temp directory, upload toàn bộ lên SeaweedFS rồi xóa temp directory.
- Lưu tile theo key dạng `photos/{photoId}/v{n}/tiles/{z}/{x}_{y}.webp` và có manifest/DZI.
- Trang chi tiết dùng OpenSeadragon hoặc viewer tương đương để chỉ tải tile đang nằm trong viewport.
- Trong khi tile nét chưa tải xong, giữ level thấp/preview ở dưới.
- Không ghép tile thành một file hoàn chỉnh trong browser và không dùng tile làm nguồn chỉnh sửa. Mọi chỉnh sửa phải áp dụng trên normalized original phía server.
- Nếu tính năng tile làm cản trở hoàn thành core requirements, hoàn thành và test core trước, sau đó triển khai tile trong module độc lập; không được làm hỏng gallery responsive thông thường.

# SeaweedFS object storage

Tạo Docker Compose có SeaweedFS master, volume, filer và S3 gateway. Backend sử dụng S3-compatible client:

- Endpoint, bucket, access key và secret key lấy từ environment.
- Dùng path-style nếu cần.
- Tự tạo bucket trong bootstrap development hoặc cung cấp script rõ ràng.
- `.env.example` chỉ chứa credential mẫu, không chứa secret thật.
- Cấu hình S3 gateway giới hạn concurrent upload phù hợp môi trường lab, ví dụ `concurrentFileUploadLimit` khoảng 10 và `concurrentUploadLimitMB` khoảng 128; ghi rõ đây là giá trị development có thể chỉnh.
- Không đưa SeaweedFS credential vào frontend.
- Sau khi restart API và SeaweedFS containers có persistent volume, gallery và media URL vẫn hoạt động.

Nếu object đã ghi nhưng DB transaction thất bại:

- Xóa ngay các object vừa tạo; hoặc
- Ghi cleanup job/outbox đủ bền vững để dọn lại.

Cleanup phải idempotent. Có test mô phỏng DB lỗi sau khi object đã được ghi và xác nhận storage không còn file mồ côi sau cleanup.

## Hướng dẫn cấu hình SeaweedFS bắt buộc

Agent không được chỉ tạo `docker-compose.yml` rồi bỏ qua phần hướng dẫn. Phải hướng dẫn người dùng cấu hình và kiểm tra SeaweedFS từng bước trong README, ưu tiên câu lệnh chạy được trên Windows PowerShell vì project nằm tại `D:\Code_lab\WEB\W9`.

Tài liệu phải có tối thiểu:

1. Giải thích ngắn vai trò của từng service:
   - Master quản lý topology và vị trí volume.
   - Volume Server lưu dữ liệu object/chunk.
   - Filer quản lý namespace và metadata file.
   - S3 Gateway cung cấp API tương thích S3 cho backend.
2. Sơ đồ port và endpoint thực tế được dùng trong Docker Compose, nêu rõ port nào chỉ dùng nội bộ và port nào backend/host truy cập.
3. Cách tạo các thư mục/volume Docker để dữ liệu SeaweedFS tồn tại sau restart.
4. Cách khởi động riêng SeaweedFS và cách xem log/health của từng service.
5. Cách tạo hoặc bootstrap bucket dùng cho ảnh, ví dụ `photo-gallery`, bằng script idempotent hoặc AWS CLI/S3 client; chạy lại không được gây lỗi phá hệ thống.
6. Cách cấu hình S3 identity/credential development bằng file cấu hình hoặc cơ chế phù hợp với phiên bản SeaweedFS đang dùng. Credential chỉ là mẫu local và phải nằm trong `.env.example`, không commit credential thật.
7. Cách cấu hình backend:

```env
S3_ENDPOINT=http://localhost:8333
S3_REGION=us-east-1
S3_BUCKET=photo-gallery
S3_ACCESS_KEY_ID=development-only
S3_SECRET_ACCESS_KEY=development-only
S3_FORCE_PATH_STYLE=true
```

Giá trị thực tế phải khớp Docker network: giải thích khi backend chạy trên host thì dùng `localhost`, còn khi backend chạy trong Docker Compose thì endpoint phải dùng service name như `http://seaweedfs-s3:8333`.

8. Cách giới hạn upload đồng thời ở S3 Gateway cho môi trường development, gồm `concurrentFileUploadLimit`, `concurrentUploadLimitMB` và timeout liên quan; giải thích `0` thường có nghĩa là không giới hạn và không nên để mặc định khi public.
9. Giải thích `volume.fileSizeLimitMB` khác với giới hạn ảnh của ứng dụng; ứng dụng vẫn phải chặn 10 MiB/file và 25 MP dù SeaweedFS cho phép object/chunk lớn hơn.
10. Giải thích Filer có thể chunk file lớn và `maxMB` không phải giới hạn nghiệp vụ của ảnh.
11. Cách xác minh S3 Gateway hoạt động bằng một file test vô hại:
    - List bucket.
    - Upload object.
    - `HEAD`/đọc object.
    - Xóa object test.
12. Cách kiểm tra persistence:
    - Upload một ảnh qua ứng dụng.
    - Ghi lại photo ID/storage key.
    - Restart API và các container SeaweedFS mà không xóa Docker volume.
    - Kiểm tra gallery và media URL vẫn hoạt động.
13. Cách phân biệt `docker compose restart/down` với `docker compose down -v`; cảnh báo rõ `-v` sẽ xóa volume và dữ liệu development.
14. Cách quan sát object/key phục vụ nghiệm thu mà không cần truy cập trực tiếp file vật lý của volume server.
15. Troubleshooting tối thiểu cho các lỗi thường gặp:
    - Backend dùng sai endpoint giữa host và Docker network.
    - Connection refused ở port S3.
    - Bucket chưa tồn tại.
    - Sai access key/secret key hoặc IAM action.
    - CORS nếu browser truy cập media khác origin.
    - `SignatureDoesNotMatch`, region/path-style sai.
    - Volume hết dung lượng hoặc chuyển read-only.
    - Object đã ghi nhưng DB thất bại và cần chạy cleanup.

Tạo các script hoặc npm task dễ nhớ, tên có thể điều chỉnh theo project nhưng README phải dùng đúng tên thực tế, ví dụ:

```text
npm run infra:up
npm run infra:logs
npm run storage:bootstrap
npm run storage:verify
npm run infra:restart
npm run infra:down
```

`storage:verify` phải thực sự kiểm tra put/get/head/delete đối với SeaweedFS S3 Gateway và trả exit code khác 0 khi thất bại. Không yêu cầu người dùng tự đoán cấu hình từ source code.

# Cache cho nhiều người dùng

Không lưu binary ảnh trong Redis. Phân chia cache như sau:

## Browser và CDN/media proxy

Variant và tile có URL versioned/immutable:

```http
Cache-Control: public, max-age=31536000, immutable
ETag: "..."
Content-Type: image/webp
X-Content-Type-Options: nosniff
```

Normalized original chỉ công khai nếu sản phẩm thực sự cần. Nếu công khai thì vẫn phải là bản đã re-encode và strip metadata, không phải raw upload.

`index.html`:

```http
Cache-Control: no-cache
```

JS/CSS hashed:

```http
Cache-Control: public, max-age=31536000, immutable
```

Nếu triển khai Nginx proxy cache, đặt trước media endpoint/SeaweedFS và thêm cấu hình purge hoặc bỏ qua cache cho response lỗi. Đây là CDN simulation cho local; không hard-code phụ thuộc vào một nhà cung cấp CDN.

## Redis

Cache metadata, không cache file ảnh:

- `photo:{id}` TTL khoảng 1–5 phút.
- `gallery:public:{cursor}:{limit}` TTL khoảng 15–30 giây.
- Cache theo cursor/pagination, không cache cả gallery thành một object vô hạn.
- Dùng cache-aside và chống stampede tối thiểu nếu nhiều request cùng miss.
- Upload/edit/delete phải invalidate các key liên quan sau khi DB commit thành công.

## Client CSR

TanStack Query dùng key tối thiểu:

- `['photos', cursor]`
- `['photo', photoId]`

`staleTime` khoảng 15–30 giây. Khi chính client upload/edit/delete, cập nhật optimistic nếu an toàn hoặc invalidate query. Dùng SSE endpoint để broadcast các event nhỏ:

```text
PHOTO_CREATED
PHOTO_UPDATED
PHOTO_DELETED
```

Client khác nhận event thì invalidate/refetch metadata. Không gửi binary ảnh qua SSE. Chỉ phát event sau khi object, metadata và `currentVersion` đã sẵn sàng để tránh client nhận URL 404.

# API tối thiểu

Thiết kế API rõ ràng, có validation schema và error code ổn định. Tối thiểu gồm:

```text
POST   /api/photos/upload
GET    /api/photos?cursor=&limit=
GET    /api/photos/:id
DELETE /api/photos/:id
GET    /api/events
GET    /media/* hoặc cơ chế tạo URL media an toàn
```

Bonus editing:

```text
POST /api/photos/:id/edits
POST /api/photos/:id/restore
```

Media response phải hỗ trợ `HEAD`, ETag/conditional request và đúng `Content-Type`. Nếu proxy qua backend, stream từ S3; không buffer toàn object vào RAM.

# Xóa ảnh

Luồng xóa phải:

1. Chuyển trạng thái sang DELETING hoặc dùng transaction/outbox tương đương.
2. Loại ảnh khỏi gallery.
3. Xóa metadata/đánh dấu đã dọn theo lựa chọn được ghi trong README.
4. Xóa normalized original, toàn bộ variant, tile và version liên quan khỏi SeaweedFS.
5. Invalidate Redis.
6. Phát `PHOTO_DELETED`.
7. Có thể retry an toàn nếu một bước thất bại.

Sau khi cleanup hoàn tất, storage không còn key liên quan và DB không còn bản ghi hoặc có trạng thái DELETED/cleanup hoàn tất đúng như README mô tả.

Vì URL media được cache lâu, nếu xóa vì lý do riêng tư phải có khả năng purge CDN/proxy cache. Trong local Nginx có thể tài liệu hóa cách purge hoặc dùng version/private route. Không coi việc xóa object là cách thu hồi những byte đã nằm trong browser cache.

# Bonus chỉnh sửa ảnh

Phần bonus là yêu cầu quan trọng về trải nghiệm người dùng và phải được triển khai sau core:

- Mỗi lần chỉnh sửa bắt đầu từ normalized original, không từ thumbnail/variant đã nén.
- Browser cung cấp preview tương tác.
- Client chỉ gửi tham số chỉnh sửa, không gửi lại ảnh đã render từ canvas.
- Crop là hình chữ nhật nằm hoàn toàn trong tọa độ ảnh gốc.
- Rotation chỉ nhận `0`, `90`, `180`, `270`.
- Flip horizontal chỉ nhận boolean.
- Restore sinh lại variant từ normalized original.
- Server validate toàn bộ tọa độ và phép biến đổi; không tin client.
- Variant sau chỉnh sửa không có EXIF/GPS.
- Ghi toàn bộ object `v2`, ghi metadata `v2`, sau đó mới cập nhật `currentVersion=2`.
- Nếu bất kỳ bước nào thất bại, `currentVersion` vẫn trỏ đến version cũ và object version mới được cleanup/retry.
- Version cũ được dọn theo retention policy ngắn được ghi rõ trong README; với bài tập có thể dọn ngay sau khi version mới publish thành công hoặc giữ một khoảng thời gian cấu hình được.

UI editor nên có:

- Khung preview lớn, responsive.
- Crop trực quan bằng drag handles.
- Nút xoay trái/phải.
- Toggle lật ngang.
- Nút reset preview.
- Nút khôi phục bản gốc.
- Nút Apply/Publish có trạng thái loading và không cho submit lặp.
- So sánh trước/sau hoặc nút giữ để xem bản trước nếu triển khai hợp lý.
- Thông báo rõ khi đang xử lý và khi version mới đã được công bố.

# Yêu cầu UI và UX

Thiết kế tone màu sáng, tối giản nhưng hiện đại:

- Nền trắng hoặc xám rất nhạt, accent xanh lam/xanh ngọc nhẹ.
- Typography rõ ràng, khoảng trắng thoáng, card bo góc vừa phải, shadow nhẹ.
- Responsive tốt từ mobile đến desktop.
- Header đơn giản, khu upload, trạng thái xử lý, gallery grid và trang chi tiết.
- Upload zone hỗ trợ click và drag/drop.
- Hiển thị rõ `1–5 ảnh`, `10 MiB/ảnh`, định dạng chấp nhận và giới hạn kích thước.
- Preview danh sách file trước upload, cho phép bỏ từng file.
- Progress/status riêng từng file: queued, uploading, processing, ready, rejected.
- Error message dễ hiểu, không chỉ hiện stack trace hoặc mã kỹ thuật.
- Gallery có skeleton, empty state, retry state và pagination/infinite scroll hợp lý.
- Card ảnh có thumbnail, alt, kích thước hoặc thời gian; thao tác mở chi tiết và xóa rõ ràng.
- Xóa cần confirm trong UI.
- Bảo đảm keyboard navigation, focus visible, label, ARIA cần thiết và contrast tốt.
- Không tạo giao diện nặng nề hoặc nhiều dashboard widget không liên quan.

Phần bonus editor cần được ưu tiên UX: thao tác trực quan, preview mượt, nút undo/reset rõ, không để người dùng nhầm giữa preview client và bản đã publish trên server.

# Yêu cầu kiểm thử bắt buộc

Tạo test fixtures bằng script hoặc test setup, không commit malware thật. Phải có:

1. JPEG hợp lệ.
2. PNG hợp lệ.
3. JPEG có EXIF orientation khác 1 để kiểm tra auto-rotate.
4. JPEG có GPS EXIF giả, ví dụ tọa độ không phải dữ liệu cá nhân thật.
5. File text đổi đuôi thành `.jpg`.
6. File giả EXE an toàn chỉ chứa header `MZ` và dữ liệu vô hại, đổi đuôi `.jpeg`.
7. File có magic byte JPEG giả nhưng nội dung không decode được.
8. JPEG/PNG bị cắt mất bytes ở cuối.
9. File vượt 10 MiB.
10. Ảnh vượt 25 megapixel hoặc vượt width/height limit nhưng có thể nén nhỏ.
11. Request có hơn 5 file.
12. Request trộn file hợp lệ và không hợp lệ.

Test unit/integration phải chứng minh:

- JPEG và PNG tạo `Photo`, `PhotoVersion` và các `PhotoVariant` tương ứng.
- File giả không tạo DB record và không tạo object bền vững.
- Mixed request vẫn lưu file hợp lệ và trả lỗi riêng cho file sai.
- File vượt byte/pixel bị từ chối trước khi gây xử lý tốn tài nguyên.
- Ảnh truncated bị từ chối.
- Ảnh EXIF orientation hiển thị đúng width/height sau rotate.
- Normalized original, variant và tile không còn GPS EXIF.
- DB chỉ chứa storage key.
- DB failure sau khi ghi object dẫn đến cleanup object.
- Restart API/SeaweedFS với volume persistent vẫn đọc được gallery và media.
- Media trả đúng `Content-Type`, `Cache-Control`, `ETag` và `X-Content-Type-Options`.
- DOM gallery có `srcset`, `sizes`, `width`, `height`, `loading` và `alt`.
- Network không mặc định tải large/original cho card gallery.
- Upload/edit/delete invalidate Redis và client khác nhận SSE event.
- Xóa dọn hết object/metadata liên quan.
- Edit validation từ chối crop ngoài ảnh, góc xoay sai và kiểu flip sai.
- Publish version mang tính nguyên tử ở cấp ứng dụng: version lỗi không trở thành current.

# Bằng chứng nghiệm thu

Tạo thư mục `evidence/` hoặc tài liệu tương đương, không chứa secret thật, bao gồm:

- Hướng dẫn ghi lại Network request multipart và response từng file.
- Ví dụ GET media với response headers.
- Truy vấn hoặc script liệt kê `Photo`, `PhotoVersion`, `PhotoVariant` và storage key.
- Kết quả test file giả, file thiếu bytes, file vượt limit và EXIF GPS.
- Cách kiểm tra EXIF trước/sau bằng công cụ hoặc test tự động.
- Kết quả restart persistence.
- Kết quả failure injection và orphan cleanup.
- Ảnh chụp UI hoặc Playwright screenshots nếu môi trường cho phép.

# Tài liệu và vận hành

README phải viết đủ để người khác clone/chạy/nghiệm thu:

- Sơ đồ kiến trúc.
- Yêu cầu hệ thống.
- Cách chạy Docker Compose và application.
- Cách migrate/seed database.
- Cấu hình `.env.example`.
- Giải thích object key/versioning.
- Giải thích cache browser/CDN, Redis và TanStack Query.
- Giải thích upload validation và vì sao extension/MIME/magic byte riêng lẻ không đủ.
- Giải thích EXIF orientation và GPS stripping.
- Giải thích variant so với Deep Zoom tiles.
- Quy trình cleanup và retention version cũ.
- Các lệnh chạy unit, integration và E2E test.
- Các trade-off còn lại nếu có.

Docker volumes phải bảo đảm PostgreSQL, Redis nếu cần, và SeaweedFS data tồn tại sau container restart. Redis không phải nguồn dữ liệu chính nên mất Redis không được làm mất ảnh hoặc metadata; ứng dụng phải tự phục hồi cache từ DB.

# Trình tự triển khai

Thực hiện theo thứ tự để luôn giữ một hệ thống chạy được:

1. Khảo sát thư mục, đọc hướng dẫn repo và xác định stack hiện có.
2. Scaffold frontend/backend/infrastructure nếu chưa có.
3. Chạy PostgreSQL, Redis, SeaweedFS; tạo migration và storage adapter.
4. Hoàn thành upload streaming, validation, normalization, variant và persistence.
5. Hoàn thành gallery/detail/delete và media headers.
6. Thêm Redis cache, TanStack Query và SSE invalidation.
7. Thêm test fixtures và core acceptance tests.
8. Thêm bonus editor với version publish an toàn.
9. Thêm Deep Zoom cho ảnh lớn mà không phá luồng responsive variants.
10. Hoàn thiện UI/UX, accessibility, evidence và README.
11. Chạy format, lint, typecheck, unit/integration/E2E; sửa lỗi thật sự.
12. Khởi động lại stack và kiểm tra persistence.

Không dừng ở scaffold hoặc TODO. Không tuyên bố hoàn thành khi test chưa chạy. Nếu môi trường thiếu dependency hoặc dịch vụ khiến một nhóm test không chạy được, vẫn hoàn thành phần có thể làm, ghi chính xác blocker, lệnh đã chạy và phần chưa được xác minh.

# Definition of Done

Chỉ coi công việc hoàn tất khi:

- Core slide 32–37 đã được triển khai và có test/evidence.
- Storage bền vững đã chuyển từ local filesystem sang SeaweedFS.
- Upload 1–5 file trả kết quả từng file.
- Validation chặn file giả, EXE đổi đuôi, truncated image, byte/pixel overflow.
- Ảnh đã auto-orient, re-encode và strip GPS EXIF.
- Có tối đa ba responsive variants và gallery không tải file lớn mặc định.
- Gallery/detail/delete hoạt động sau restart.
- Cache đúng tầng, object URL immutable, Redis không chứa binary và nhiều client được đồng bộ qua SSE.
- Bonus crop/rotate/flip/restore hoạt động trên normalized original và publish version an toàn.
- UI sáng, đơn giản, hiện đại, responsive và có UX tốt cho upload/editor.
- Test, typecheck và lint đạt; README và `.env.example` đủ dùng; không có credential thật.
- `Note.md` được giữ nguyên hoặc chỉ được bổ sung khi thực sự cần, không bị xóa.

Khi bàn giao, hãy báo cáo ngắn gọn: kiến trúc đã triển khai, các file chính, cách chạy, kết quả test, bằng chứng nghiệm thu và mọi giới hạn còn lại.

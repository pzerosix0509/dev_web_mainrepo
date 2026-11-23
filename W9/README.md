# Lumen Photo Gallery

Ứng dụng CSR Photo Gallery dùng chung, triển khai theo tiêu chí slide 32–42: upload 1–5 file với kết quả độc lập, kiểm tra ảnh nhiều lớp, responsive variants, trang chi tiết/xóa, cache đúng tầng và chỉnh sửa theo version. Khác với ví dụ local filesystem trong slide, binary bền vững nằm trong SeaweedFS qua S3 Gateway; PostgreSQL chỉ lưu storage key.

## Kiến trúc

```text
React/Vite CSR ─ TanStack Query + browser cache ─┐
                                                 ├─ Fastify API ─ PostgreSQL (metadata)
SSE PHOTO_CREATED/UPDATED/DELETED ───────────────┤              ├ Redis (query cache)
                                                 └─ media stream └ SeaweedFS S3 (binary)
```

- `apps/web`: React Router, upload drag/drop, responsive gallery/detail/editor.
- `apps/api`: Fastify multipart streaming, Sharp/libvips, Prisma, Redis, SSE, S3 adapter.
- `Photo -> PhotoVersion -> PhotoVariant`: version mới được ghi đủ object và metadata rồi mới đổi `currentVersion`.
- Key bất biến: `photos/{photoId}/v{version}/original.jpg|png|webp`, `thumb.webp`, `medium.webp`, `large.webp`.
- Redis chỉ cache JSON metadata: detail 180 giây, page cursor 20 giây. Redis mất không làm mất dữ liệu.
- Nginx production container phục vụ CSR shell (`index.html: no-cache`), asset hash immutable, proxy SSE và mô phỏng CDN cache cho `/media` với `X-Cache-Status`.

## Yêu cầu và chạy nhanh (PowerShell)

Cần Node.js 22+, Docker Desktop có Compose v2. Từ `D:\Code_lab\WEB\W9`:

```powershell
Copy-Item .env.example .env
npm install
npm run infra:up
npm run storage:bootstrap
npm run storage:verify
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

Mở `http://localhost:5173`; API ở `http://localhost:3001`. Nếu chạy API trong Compose, dùng `S3_ENDPOINT=http://seaweedfs-s3:8333`; nếu chạy API trên host, dùng `http://localhost:8333`. Không đưa S3 credential vào biến `VITE_*`.

Hoặc chạy trọn stack production-like (Nginx + API + hạ tầng): `docker compose up -d --build`, sau đó mở cùng URL `http://localhost:5173`.

Các lệnh vận hành:

```powershell
npm run infra:up
npm run infra:logs
npm run storage:bootstrap
npm run storage:verify
npm run infra:restart
npm run infra:down
```

`docker compose down` bỏ container/network nhưng giữ named volumes. `docker compose down -v` **xóa PostgreSQL và toàn bộ dữ liệu SeaweedFS development**; không dùng khi kiểm tra persistence.

Local Nginx chỉ cache response media 200. Khi cần purge vì xóa riêng tư, chạy `docker compose up -d --force-recreate web` để thay container/cache; URL versioned mới tự tránh cache cũ, nhưng byte đã nằm trong browser cache không thể thu hồi từ server.

## SeaweedFS từng bước

### Vai trò, port và persistence

| Service | Vai trò | Host | Nội bộ Compose | Volume |
|---|---|---:|---|---|
| Master | topology, vị trí volume | `9333` | `seaweedfs-master:9333` | `seaweed-master-data` |
| Volume Server | lưu chunk/object bytes | `8080` | `seaweedfs-volume:8080` | `seaweed-volume-data` |
| Filer | namespace và metadata file | `8888` | `seaweedfs-filer:8888` | `seaweed-filer-data` |
| S3 Gateway | API S3 cho backend | `8333` | `seaweedfs-s3:8333` | dữ liệu nằm qua Filer/Volume |

Compose tự tạo named volumes. Xem chúng bằng `docker volume ls | Select-String seaweed-photo-gallery`. Chạy riêng storage:

```powershell
docker compose up -d seaweedfs-master seaweedfs-volume seaweedfs-filer seaweedfs-s3
docker compose ps
docker compose logs seaweedfs-master seaweedfs-volume seaweedfs-filer seaweedfs-s3
Invoke-WebRequest http://localhost:9333/cluster/status
Invoke-WebRequest http://localhost:8888/
```

`infra/seaweedfs/s3.json` khai báo identity local khớp `.env.example`. Đây chỉ là credential development mẫu; production phải mount secret ngoài repo, giới hạn IAM và TLS. Compose pin SeaweedFS `4.54`. Gateway được đặt `concurrentFileUploadLimit=10`, `concurrentUploadLimitMB=128`, `inflightUploadDataTimeout=60s` và idle timeout 120 giây. Giá trị `0` thường là không giới hạn và không phù hợp endpoint public.

`master -volumeSizeLimitMB=1024`/`volume.fileSizeLimitMB` là giới hạn file/chunk ở tầng storage, không phải luật ảnh. Filer có thể chunk file lớn và `maxMB` không thay thế giới hạn nghiệp vụ: API vẫn chặn 10 MiB/file, khoảng 55 MiB/request, 8.000 px/cạnh và 25 MP.

Bucket bootstrap idempotent và kiểm tra thật:

```powershell
npm run storage:bootstrap
npm run storage:verify
```

`storage:verify` thực hiện create-bucket (hoặc chấp nhận bucket đã có), PUT, HEAD, GET, LIST, đối chiếu bytes rồi DELETE; bất kỳ bước nào sai đều trả exit code khác 0. Với AWS CLI có thể quan sát key mà không đọc file vật lý:

```powershell
$env:AWS_ACCESS_KEY_ID='development-only'
$env:AWS_SECRET_ACCESS_KEY='development-only'
$env:AWS_DEFAULT_REGION='us-east-1'
aws --endpoint-url http://localhost:8333 s3 ls s3://photo-gallery --recursive
```

### Kiểm tra persistence

1. Upload ảnh qua UI, ghi `photoId` và storage key từ truy vấn trong `evidence/README.md`.
2. Chạy `npm run infra:restart` và restart API; **không** chạy `down -v`.
3. Tải lại `/api/photos`, mở URL `/media/...` cũ và kiểm tra HEAD vẫn 200, ETag không đổi.
4. Có thể dừng hẳn bằng `docker compose down`, sau đó `npm run infra:up`; named volumes vẫn giữ dữ liệu.

### Troubleshooting

- `ECONNREFUSED :8333`: kiểm tra `docker compose ps/logs`; Gateway chờ Filer. Host dùng `localhost`, container dùng service name.
- `NoSuchBucket`: chạy `npm run storage:bootstrap` sau khi S3 sẵn sàng.
- `AccessDenied`: credential phải khớp `s3.json`; kiểm tra identity/action, không sửa frontend.
- `SignatureDoesNotMatch`: region `us-east-1`, endpoint đúng và `S3_FORCE_PATH_STYLE=true`.
- CORS media: mặc định browser tải qua API cùng endpoint cấu hình. Nếu tách origin, thêm origin chính xác; không dùng `*` cho credentialed requests.
- Volume đầy/read-only: xem Volume log, dung lượng Docker Desktop và `/dir/status`; mở rộng volume trước retry.
- Object đã ghi nhưng DB lỗi: service xóa ngay key đã ghi. Nếu cleanup của luồng xóa lỗi, `CleanupJob` giữ danh sách và startup retry idempotent; kiểm tra log + list prefix.

## Upload và xử lý an toàn

Fastify đọc multipart dạng stream vào temp directory riêng, giới hạn 10 MiB/file và dọn trong `finally`; không buffer toàn request. Mỗi file đi qua:

1. allowlist extension cuối; sanitize tên chỉ để hiển thị;
2. so MIME khai báo với loại do `file-type` phát hiện từ nội dung;
3. Sharp đọc metadata với `limitInputPixels`, chặn frame động, 8.000 px và 25 MP;
4. decode thật với `failOn:error`, auto-orient bằng EXIF rồi re-encode;
5. output không gọi `withMetadata`, do đó EXIF/GPS bị strip;
6. tạo variant WebP 320/1024/1920, không upscale và không tạo width trùng;
7. upload key UUID/versioned, transaction ghi metadata và publish READY.

Extension, MIME hoặc vài magic bytes riêng lẻ đều không đủ: chúng không phát hiện file truncated, fake magic/polyglot hoặc ảnh khai báo pixel khổng lồ. Decode + re-encode là ranh giới công bố; byte raw upload không bao giờ được phục vụ.

Nếu DB transaction thất bại sau PUT, `createPhoto/publishVersion` xóa tất cả object vừa tạo. Xóa ảnh claim trạng thái `DELETING`, loại khỏi gallery, liệt kê/xóa toàn prefix rồi đánh dấu `DELETED`; retry an toàn vì xóa object không tồn tại là idempotent. URL đã vào browser cache không thể thu hồi tuyệt đối; hệ thống thật cần CDN purge khi xóa vì riêng tư.

## Hiển thị, cache và đồng bộ

- Gallery dùng thumb làm `src`, các variant thật làm `srcset`, `sizes`, kích thước, `alt`, `loading=lazy`; original chỉ dùng cho xử lý/server và detail không tải mặc định.
- `/media/*` xác minh key có trong DB, stream từ S3 và hỗ trợ GET/HEAD với `Content-Type`, ETag, `nosniff`, `public, max-age=31536000, immutable`.
- Vite tạo JS/CSS hashed; production proxy nên đặt `index.html: no-cache` và asset hashed: cache một năm immutable.
- TanStack Query `staleTime=20s`; mutation và một SSE connection/client invalidate `['photos']`, `['photo', id]`. SSE chỉ gửi ID/type sau publish.
- Redis dùng cache-aside cursor/detail và invalidation sau commit. Không có binary trong Redis.

## Chỉnh sửa và version

UI preview xoay/lật/crop nhưng chỉ gửi tham số. Server luôn đọc normalized original của version 1, validate crop nằm trong ảnh, chỉ nhận rotation `0|90|180|270` và boolean flip, rồi tạo trọn bộ `vN`. Transaction tạo metadata, kiểm tra optimistic `currentVersion`, cập nhật pointer và `publishedAt`; conflict/lỗi dọn toàn object vN và version cũ tiếp tục hoạt động. Restore cũng sinh version mới từ normalized original.

Version cũ được giữ 24 giờ theo `VERSION_RETENTION_HOURS`; startup và timer mỗi giờ xóa idempotent các version hết hạn nhưng luôn giữ normalized original v1 để restore và version đang công bố. Không ghi đè key cũ vì browser/CDN có thể đang cache.

Deep Zoom được tách khỏi core bằng `ENABLE_DEEP_ZOOM`/`DEEP_ZOOM_MIN_PIXELS`. Ảnh từ 12 MP sinh pyramid WebP 256×256 trong temp directory, upload `tiles/{z}/{x}_{y}.webp` cùng manifest JSON rồi dọn temp. Trang chi tiết lazy-load OpenSeadragon bằng chunk riêng và chỉ lấy tile trong viewport; responsive variant thấp nằm phía dưới trong lúc tile nét tải.

## Test và nghiệm thu

```powershell
node scripts/generate-fixtures.mjs
npm run typecheck
npm test
npm run build
```

Fixtures là dữ liệu vô hại được sinh cục bộ: JPEG/PNG, orientation, text đổi đuôi, `MZ` giả, fake JPEG magic, truncated và >10 MiB. Không có malware thật. Hướng dẫn bằng chứng Network/DB/storage/restart nằm ở `evidence/README.md`.

Các integration cần PostgreSQL/Redis/SeaweedFS đang chạy. `Note.md` được giữ nguyên. Trade-off còn lại: chưa có antivirus (không thay decode/re-encode), auth/owner và CDN purge. Core không tự fallback sang local filesystem khi S3 lỗi để tránh phân mảnh dữ liệu.

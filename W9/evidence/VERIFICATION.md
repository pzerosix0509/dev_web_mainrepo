# Verification record — 2026-11-23

Executed from `D:\Code_lab\WEB\W9`:

| Check | Result |
|---|---|
| `npm run lint` | PASS, 0 warnings |
| `npm run typecheck` | PASS, API + web |
| `npm test` | PASS, API 13 + web 1 tests |
| `npm run build` | PASS, API TypeScript + Vite production bundle |
| `npm audit` | PASS, 0 vulnerabilities |
| `docker compose config --quiet` | PASS |
| Storage/bootstrap script syntax | PASS (`node --check`) |

Covered automatically:

- valid JPEG/PNG normalization and responsive variant widths;
- harmless `MZ` file, text renamed as image, fake JPEG magic and truncated JPEG rejection;
- mixed valid/fake multipart partial success and sixth-file rejection;
- EXIF orientation before metadata stripping;
- no EXIF in normalized original/variant/tile;
- crop bounds validation;
- compensation deletes uploaded objects after injected DB failure;
- 12 MP Deep Zoom pyramid generation with 256 px WebP tiles;
- media GET/HEAD, immutable cache headers, ETag and conditional 304;
- gallery DOM uses thumb source, `srcset`, `sizes`, intrinsic dimensions, lazy loading and alt text.

Runtime integration blocker in this execution environment:

```text
permission denied while trying to connect to the docker API at
npipe:////./pipe/dockerDesktopLinuxEngine
```

The sandbox cannot represent or grant a Windows named-pipe permission. Therefore PostgreSQL migration, live SeaweedFS `storage:verify`, end-to-end upload and restart persistence were not executed here. Follow the exact PowerShell sequence in the root README on a normal Docker Desktop shell, then attach the correlated evidence described in `evidence/README.md`.

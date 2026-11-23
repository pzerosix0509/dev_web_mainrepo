# Acceptance evidence

This folder is deliberately free of credentials and real location data. Run `npm run fixtures:generate` to create harmless fixtures (valid JPEG/PNG, EXIF orientation, renamed text, harmless `MZ`, fake JPEG magic bytes, truncated JPEG and an over-10-MiB file).

## Capture checklist

1. Open DevTools Network, upload `valid.jpg`, `valid.png`, `fake-exe.jpeg` together, and save the multipart request plus JSON response. The two valid rows must be `accepted`; the fake row must be `rejected`.
2. Open an image and save the GET and HEAD `/media/photos/...` responses. Record `Content-Type`, `Content-Length`, `Cache-Control`, `ETag` and `X-Content-Type-Options`.
3. Run the database evidence query:

   ```powershell
   docker compose exec postgres psql -U gallery -d gallery -c 'select p.id,p.status,p."currentVersion",v.version,v."normalizedOriginalKey",pv.kind,pv."storageKey" from "Photo" p join "PhotoVersion" v on v."photoId"=p.id left join "PhotoVariant" pv on pv."photoVersionId"=v.id order by p."createdAt" desc;'
   ```

4. List objects without accessing volume files: `aws --endpoint-url http://localhost:8333 s3api list-objects-v2 --bucket photo-gallery --prefix photos/`.
5. Save `npm test`, `npm run typecheck` and `npm run build` output. Processor tests prove real decode rejection, EXIF removal, auto-orientation and edit-bound validation.
6. Failure injection: temporarily make PostgreSQL unavailable after starting an upload (or mock the Prisma create in the service test), then list the photo prefix. `createPhoto` compensates every successfully written object before returning the error.
7. Persistence: upload an image, record its photo ID/key, run `npm run infra:restart`, restart the API, then capture the same gallery JSON and media HEAD response.
8. Responsive evidence: at mobile and desktop widths record the image element's `currentSrc`, DPR, `srcset`, `sizes`, `width`, `height`, `loading` and `alt` values. A gallery card should select thumb/medium rather than original.
9. Delete the photo, then capture the absent gallery record and an empty `list-objects-v2 --prefix photos/<id>/` result.

Use one run/photo ID across screenshots so the API response, DB rows, storage keys and network responses can be correlated.

CREATE TYPE "PhotoStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'DELETING', 'DELETED');
CREATE TYPE "VariantKind" AS ENUM ('THUMB', 'MEDIUM', 'LARGE', 'TILE', 'PREVIEW');

CREATE TABLE "Photo" (
  "id" UUID NOT NULL,
  "originalName" TEXT NOT NULL,
  "status" "PhotoStatus" NOT NULL DEFAULT 'PROCESSING',
  "detectedMimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "altText" TEXT NOT NULL,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhotoVersion" (
  "id" UUID NOT NULL,
  "photoId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "normalizedOriginalKey" TEXT NOT NULL,
  "manifestKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "PhotoVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhotoVariant" (
  "id" UUID NOT NULL,
  "photoVersionId" UUID NOT NULL,
  "kind" "VariantKind" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "checksum" TEXT,
  "tileLevel" INTEGER,
  "tileX" INTEGER,
  "tileY" INTEGER,
  CONSTRAINT "PhotoVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CleanupJob" (
  "id" UUID NOT NULL,
  "photoId" UUID,
  "storageKeys" TEXT[],
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CleanupJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Photo_status_createdAt_idx" ON "Photo"("status", "createdAt" DESC);
CREATE UNIQUE INDEX "PhotoVersion_photoId_version_key" ON "PhotoVersion"("photoId", "version");
CREATE UNIQUE INDEX "PhotoVariant_storageKey_key" ON "PhotoVariant"("storageKey");
CREATE INDEX "PhotoVariant_photoVersionId_kind_idx" ON "PhotoVariant"("photoVersionId", "kind");
ALTER TABLE "PhotoVersion" ADD CONSTRAINT "PhotoVersion_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoVariant" ADD CONSTRAINT "PhotoVariant_photoVersionId_fkey" FOREIGN KEY ("photoVersionId") REFERENCES "PhotoVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

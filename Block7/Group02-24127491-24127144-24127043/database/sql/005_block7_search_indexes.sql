-- Block 7: Cấu hình PostgreSQL cho Full-Text Search và Fuzzy Search
-- Chạy trên Supabase SQL Editor sau khi đã chạy 001..004

-- 1. Kích hoạt extension pg_trgm cho Fuzzy Search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN Index cho Full-Text Search với cấu hình 'simple' trên cả (name + description)
-- Coalesce tránh lỗi NULL khi nối chuỗi văn bản
CREATE INDEX IF NOT EXISTS "Dish_fts_idx"
  ON public."Dish"
  USING gin(to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

-- 3. GIN Trigram Index cho Fuzzy Search trên tên món ăn
CREATE INDEX IF NOT EXISTS "Dish_name_trgm_idx"
  ON public."Dish"
  USING gin(name gin_trgm_ops);

-- 4. B-Tree Indexes phục vụ tăng tốc Filter và Pagination
CREATE INDEX IF NOT EXISTS "Dish_category_idx" ON public."Dish" ("category");
CREATE INDEX IF NOT EXISTS "Dish_price_idx" ON public."Dish" ("price");
CREATE INDEX IF NOT EXISTS "Dish_available_idx" ON public."Dish" ("available");
CREATE INDEX IF NOT EXISTS "Dish_createdAt_idx" ON public."Dish" ("createdAt");

-- 5. Query kiểm tra cấu hình
SELECT
  extname, extversion
FROM pg_extension
WHERE extname = 'pg_trgm';

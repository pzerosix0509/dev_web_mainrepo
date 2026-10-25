-- Chỉ chạy khi 002 không còn trả về Dish có chefId NULL.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."Dish" WHERE "chefId" IS NULL) THEN
    RAISE EXCEPTION 'Không thể enforce: vẫn còn Dish thiếu chefId';
  END IF;
END $$;

ALTER TABLE public."Dish"
  ALTER COLUMN "chefId" SET NOT NULL;

ALTER TABLE public."Dish"
  ADD CONSTRAINT "Dish_chefId_fkey"
  FOREIGN KEY ("chefId") REFERENCES public."Chef" (id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

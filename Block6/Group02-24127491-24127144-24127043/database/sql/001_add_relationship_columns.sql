-- Chạy trên Supabase SQL Editor sau khi kiểm tra backup.
-- Không xóa hoặc reset dữ liệu hiện có.

ALTER TABLE public."Dish"
  ADD COLUMN IF NOT EXISTS "chefId" integer;

CREATE TABLE IF NOT EXISTS public."DishIngredient" (
  "dishId" integer NOT NULL,
  "ingredientId" integer NOT NULL,
  CONSTRAINT "DishIngredient_pkey" PRIMARY KEY ("dishId", "ingredientId"),
  CONSTRAINT "DishIngredient_dishId_fkey"
    FOREIGN KEY ("dishId") REFERENCES public."Dish" (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DishIngredient_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES public."Ingredient" (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DishIngredient_ingredientId_idx"
  ON public."DishIngredient" ("ingredientId");

CREATE INDEX IF NOT EXISTS "Dish_chefId_idx"
  ON public."Dish" ("chefId");

-- Chạy sau 001.
-- Các mapping dưới đây dựa trên tên trong seed Block5 để không phụ thuộc ID tự tăng.
-- Hãy chỉnh các dòng mapping nếu dữ liệu thực tế trên Supabase khác.

BEGIN;

-- Mapping Dish -> Chef thủ công, có thể chỉnh trước khi chạy.
UPDATE public."Dish" d
SET "chefId" = c.id
FROM public."Chef" c
WHERE d.name = 'Phở Bò Tái Lăn Hà Nội'
  AND c.name = 'Trần Thị Kim Mai';

UPDATE public."Dish" d
SET "chefId" = c.id
FROM public."Chef" c
WHERE d.name = 'Bò Wagyu Nướng Sốt Nấm Truffle'
  AND c.name = 'Phạm Minh Quân';

UPDATE public."Dish" d
SET "chefId" = c.id
FROM public."Chef" c
WHERE d.name = 'Tôm Hùm Nướng Bơ Tỏi'
  AND c.name = 'Trần Thị Kim Mai';

UPDATE public."Dish" d
SET "chefId" = c.id
FROM public."Chef" c
WHERE d.name = 'Cơm Chiên Hải Sản Cung Đình'
  AND c.name = 'Trần Thị Kim Mai';

UPDATE public."Dish" d
SET "chefId" = c.id
FROM public."Chef" c
WHERE d.name = 'Chè Hạt Sen Long Nhãn Tươi'
  AND c.name = 'Lê Hoàng Nam';

-- Mapping Dish -> Ingredients thủ công.
INSERT INTO public."DishIngredient" ("dishId", "ingredientId")
SELECT d.id, i.id
FROM public."Dish" d CROSS JOIN public."Ingredient" i
WHERE d.name = 'Phở Bò Tái Lăn Hà Nội' AND i.name IN ('Rau thơm hữu cơ')
ON CONFLICT DO NOTHING;

INSERT INTO public."DishIngredient" ("dishId", "ingredientId")
SELECT d.id, i.id
FROM public."Dish" d CROSS JOIN public."Ingredient" i
WHERE d.name = 'Bò Wagyu Nướng Sốt Nấm Truffle' AND i.name IN ('Thịt bò Wagyu', 'Nấm Truffle đen')
ON CONFLICT DO NOTHING;

INSERT INTO public."DishIngredient" ("dishId", "ingredientId")
SELECT d.id, i.id
FROM public."Dish" d CROSS JOIN public."Ingredient" i
WHERE d.name = 'Tôm Hùm Nướng Bơ Tỏi' AND i.name IN ('Tôm hùm Nha Trang', 'Rau thơm hữu cơ')
ON CONFLICT DO NOTHING;

INSERT INTO public."DishIngredient" ("dishId", "ingredientId")
SELECT d.id, i.id
FROM public."Dish" d CROSS JOIN public."Ingredient" i
WHERE d.name = 'Cơm Chiên Hải Sản Cung Đình' AND i.name IN ('Gạo ST25', 'Rau thơm hữu cơ')
ON CONFLICT DO NOTHING;

INSERT INTO public."DishIngredient" ("dishId", "ingredientId")
SELECT d.id, i.id
FROM public."Dish" d CROSS JOIN public."Ingredient" i
WHERE d.name = 'Chè Hạt Sen Long Nhãn Tươi' AND i.name IN ('Rau thơm hữu cơ')
ON CONFLICT DO NOTHING;

COMMIT;

-- Kiểm tra trước khi chạy 003.
SELECT d.id, d.name, d."chefId"
FROM public."Dish" d
WHERE d."chefId" IS NULL;

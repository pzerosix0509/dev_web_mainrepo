-- Các query kiểm tra sau migration.

SELECT d.id, d.name, c.id AS chef_id, c.name AS chef_name
FROM public."Dish" d
LEFT JOIN public."Chef" c ON c.id = d."chefId"
ORDER BY d.id;

SELECT d.id, d.name, i.id AS ingredient_id, i.name AS ingredient_name, i.unit
FROM public."Dish" d
LEFT JOIN public."DishIngredient" di ON di."dishId" = d.id
LEFT JOIN public."Ingredient" i ON i.id = di."ingredientId"
ORDER BY d.id, i.id;

SELECT d.id, d.name
FROM public."Dish" d
LEFT JOIN public."DishIngredient" di ON di."dishId" = d.id
WHERE di."dishId" IS NULL;

SELECT "dishId", "ingredientId", COUNT(*)
FROM public."DishIngredient"
GROUP BY "dishId", "ingredientId"
HAVING COUNT(*) > 1;

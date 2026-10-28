import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CHEFS_DATA = [
  { name: 'Trần Thị Kim Mai', specialty: 'Món Việt Cổ Truyền' },
  { name: 'Phạm Minh Quân', specialty: 'Bếp Trưởng Món Âu & Steak' },
  { name: 'Lê Hoàng Nam', specialty: 'Chuyên Gia Món Tráng Miệng & Bánh' },
  { name: 'Nguyễn Văn Hải', specialty: 'Hải Sản & Đồ Nướng Cao Cấp' },
  { name: 'Võ Quốc Anh', specialty: 'Ẩm Thực Fusion Á - Âu' }
];

const INGREDIENTS_DATA = [
  { name: 'Thịt bò Wagyu', unit: 'gram' },
  { name: 'Tôm sú biển', unit: 'con' },
  { name: 'Tôm hùm Nha Trang', unit: 'con' },
  { name: 'Cá hồi Na Uy', unit: 'gram' },
  { name: 'Nấm Truffle đen', unit: 'gram' },
  { name: 'Rau thơm hữu cơ', unit: 'bó' },
  { name: 'Gạo ST25', unit: 'kg' },
  { name: 'Hạt sen Huế', unit: 'gram' },
  { name: 'Tiêu đen Phú Quốc', unit: 'gam' },
  { name: 'Nước mắm cá cơm', unit: 'ml' },
  { name: 'Thịt heo Iberico', unit: 'gram' },
  { name: 'Sườn cừu Úc', unit: 'dẻ' },
  { name: 'Sò điệp Hokkaido', unit: 'con' },
  { name: 'Bơ lạt Pháp', unit: 'gram' },
  { name: 'Rượu vang đỏ', unit: 'ml' },
  { name: 'Măng tây xanh', unit: 'búp' },
  { name: 'Hành tím Lý Sơn', unit: 'củ' },
  { name: 'Tỏi cô đơn', unit: 'củ' },
  { name: 'Trứng gà ta', unit: 'quả' },
  { name: 'Phô mai Parmesan', unit: 'gram' }
];

const METHODS = ['Nướng than hoa', 'Áp chảo sốt bơ tỏi', 'Hấp lá sen', 'Xào lăn đậm đà', 'Sốt tiêu đen', 'Đút lò phô mai', 'Hầm thảo mộc', 'Rang muối ớt', 'Chiên giòn', 'Om nước dừa', 'Nấu lẩu chua cay', 'Nướng sốt BBQ'];
const PROTEINS = ['Bò Wagyu', 'Sườn cừu', 'Cá hồi', 'Tôm sú', 'Tôm hùm', 'Gà ta', 'Vịt trời', 'Mực ống', 'Bạch tuộc', 'Sò điệp', 'Thịt heo Iberico', 'Bồ câu', 'Cua biển', 'Bào ngư', 'Cá tuyết', 'Lươn đồng'];
const ACCENTS = ['kèm măng tây', 'sốt rượu vang đỏ', 'vị tiêu Phú Quốc', 'với nấm Truffle', 'hương thảo mộc', 'sốt chanh leo', 'lá chúc miền Tây', 'chấm muối ớt xanh', 'cùng cơm cháy giòn', 'sốt me cay', 'hạt sen bùi béo', 'nước cốt dừa tươi'];

const CATEGORIES = ['Món chính', 'Món khai vị', 'Món nước', 'Món tráng miệng', 'Đồ uống'];

function generateDishPool(targetCount = 1050) {
  const dishes = [];
  let count = 0;

  for (let p = 0; p < PROTEINS.length && count < targetCount; p++) {
    for (let m = 0; m < METHODS.length && count < targetCount; m++) {
      for (let a = 0; a < ACCENTS.length && count < targetCount; a++) {
        count++;
        const protein = PROTEINS[p];
        const method = METHODS[m];
        const accent = ACCENTS[a];
        const name = `${protein} ${method} ${accent} #${count}`;
        const category = count % 10 === 0 ? 'Đồ uống'
          : count % 8 === 0 ? 'Món tráng miệng'
          : count % 5 === 0 ? 'Món nước'
          : count % 4 === 0 ? 'Món khai vị'
          : 'Món chính';
        const price = Math.round((45000 + (count % 35) * 25000) / 1000) * 1000;
        const description = `Món ${protein.toLowerCase()} được chế biến công phu theo phong cách ${method.toLowerCase()}, kết hợp hài hòa ${accent.toLowerCase()} tạo nên hương vị đặc sắc khó quên.`;
        const available = count % 11 !== 0; // ~91% true, ~9% false

        dishes.push({
          name,
          category,
          price,
          description,
          available
        });
      }
    }
  }

  return dishes;
}

export async function seedDatabase() {
  console.log('🌱 Bắt đầu kiểm tra và tạo dữ liệu seed cho Block 7...');

  // 1. Đảm bảo Chefs tồn tại
  let chefs = await prisma.chef.findMany();
  if (chefs.length === 0) {
    console.log('Chưa có Chef, đang khởi tạo 5 đầu bếp mẫu...');
    await prisma.chef.createMany({ data: CHEFS_DATA });
    chefs = await prisma.chef.findMany();
  }
  console.log(`Đã có ${chefs.length} đầu bếp trong hệ thống.`);

  // 2. Đảm bảo Ingredients tồn tại
  let ingredients = await prisma.ingredient.findMany();
  if (ingredients.length === 0) {
    console.log('Chưa có Ingredient, đang khởi tạo 20 nguyên liệu mẫu...');
    await prisma.ingredient.createMany({ data: INGREDIENTS_DATA });
    ingredients = await prisma.ingredient.findMany();
  }
  console.log(`Đã có ${ingredients.length} nguyên liệu trong hệ thống.`);

  // 3. Kiểm tra số lượng Dishes
  const currentDishCount = await prisma.dish.count();
  console.log(`Số lượng món ăn hiện tại: ${currentDishCount}`);

  if (currentDishCount >= 1000) {
    console.log(`✅ Cơ sở dữ liệu đã có đủ ít nhất 1.000 món ăn (${currentDishCount} món). Bỏ qua bước tạo thêm.`);
    return;
  }

  const dishesToCreate = generateDishPool(1050);
  console.log(`Đang sinh ${dishesToCreate.length} món ăn vào database...`);

  // Phân chia theo chunks 100 để chèn nhanh và an toàn
  const chunkSize = 100;
  for (let i = 0; i < dishesToCreate.length; i += chunkSize) {
    const chunk = dishesToCreate.slice(i, i + chunkSize);
    const dishRecords = chunk.map((d, index) => {
      const chef = chefs[(i + index) % chefs.length];
      return {
        ...d,
        chefId: chef.id
      };
    });

    await prisma.dish.createMany({
      data: dishRecords,
      skipDuplicates: true
    });
  }

  const allDishes = await prisma.dish.findMany({ select: { id: true } });
  console.log(`Tổng số món ăn sau khi chèn: ${allDishes.length}`);

  // 4. Tạo quan hệ DishIngredient cho các món mới chưa có quan hệ
  console.log('Đang liên kết nguyên liệu cho các món ăn...');
  const existingRelations = await prisma.dishIngredient.findMany({ select: { dishId: true } });
  const relatedDishIds = new Set(existingRelations.map((r) => r.dishId));

  const newDishIngredients: { dishId: number; ingredientId: number }[] = [];
  for (let idx = 0; idx < allDishes.length; idx++) {
    const dishId = allDishes[idx].id;
    if (!relatedDishIds.has(dishId)) {
      const ing1 = ingredients[idx % ingredients.length].id;
      const ing2 = ingredients[(idx + 3) % ingredients.length].id;
      newDishIngredients.push({ dishId, ingredientId: ing1 });
      if (ing1 !== ing2) {
        newDishIngredients.push({ dishId, ingredientId: ing2 });
      }
    }
  }

  for (let i = 0; i < newDishIngredients.length; i += 500) {
    const chunk = newDishIngredients.slice(i, i + 500);
    await prisma.dishIngredient.createMany({
      data: chunk,
      skipDuplicates: true
    });
  }

  console.log(`✅ Seed thành công! Tổng số món ăn hiện tại: ${await prisma.dish.count()}`);
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .catch((err) => {
      console.error('Lỗi khi seed dữ liệu:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error('Seed này sẽ xóa dữ liệu hiện có. Đặt ALLOW_DESTRUCTIVE_SEED=true để xác nhận.');
  }

  console.log('--- Đang dọn dẹp dữ liệu cũ (Reset data)... ---');
  await prisma.session.deleteMany({});
  await prisma.activationChallenge.deleteMany({});
  await prisma.passwordReset.deleteMany({});
  await prisma.loginAttempt.deleteMany({});
  await prisma.captchaChallenge.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.dish.deleteMany({});
  await prisma.chef.deleteMany({});
  await prisma.ingredient.deleteMany({});

  console.log('--- Đang nạp dữ liệu mẫu (Seeding)... ---');

  const seedPassword = process.env.SEED_PASSWORD || 'Team02@hcmus';
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const now = new Date();

  await prisma.user.createMany({
    data: [
      {
        name: 'Quản Trị Viên Restaurantly',
        email: 'admin@restaurantly.vn',
        rawEmail: 'admin@restaurantly.vn',
        passwordHash,
        role: 'admin',
        status: 'active',
        isVerified: true,
        emailVerifiedAt: now
      },
      {
        name: 'Thực Khách Hội Viên',
        email: 'viewer@restaurantly.vn',
        rawEmail: 'viewer@restaurantly.vn',
        passwordHash,
        role: 'viewer',
        status: 'active',
        isVerified: true,
        emailVerifiedAt: now
      }
    ]
  });

  // Seed Chefs (Đầu bếp)
  const chefs = await prisma.chef.createMany({
    data: [
      { name: 'Nguyễn Văn Hải', specialty: 'Món nướng & BBQ cổ truyền' },
      { name: 'Trần Thị Kim Mai', specialty: 'Bếp trưởng món Á & Hải sản' },
      { name: 'Lê Hoàng Nam', specialty: 'Bếp bánh & Tráng miệng hoàng gia' },
      { name: 'Phạm Minh Quân', specialty: 'Món Âu hiện đại & Steak' }
    ]
  });

  // Seed Ingredients (Nguyên liệu)
  const ingredients = await prisma.ingredient.createMany({
    data: [
      { name: 'Thịt bò Wagyu', unit: 'kg' },
      { name: 'Gạo ST25', unit: 'kg' },
      { name: 'Tôm hùm Nha Trang', unit: 'con' },
      { name: 'Nấm Truffle đen', unit: 'gram' },
      { name: 'Rau thơm hữu cơ', unit: 'bó' }
    ]
  });

  // Seed Dishes (Món ăn)
  const dishes = await prisma.dish.createMany({
    data: [
      {
        name: 'Phở Bò Tái Lăn Hà Nội',
        description: 'Bánh phở tươi mềm, thịt bò xào lăn tỏi gừng thơm lừng cùng nước dùng xương hầm 12 tiếng.',
        price: 85000,
        category: 'Món Nước',
        available: true
      },
      {
        name: 'Bò Wagyu Nướng Sốt Nấm Truffle',
        description: 'Bò Wagyu vân mỡ tuyệt hảo kết hợp sốt kem nấm Truffle quý hiếm ăn kèm măng tây.',
        price: 450000,
        category: 'Món Chính',
        available: true
      },
      {
        name: 'Tôm Hùm Nướng Bơ Tỏi',
        description: 'Tôm hùm tươi sống Nha Trang nướng bơ tỏi Pháp thơm ngậy, giữ trọn vị ngọt tự nhiên.',
        price: 380000,
        category: 'Hải Sản',
        available: true
      },
      {
        name: 'Cơm Chiên Hải Sản Cung Đình',
        description: 'Hạt gạo ST25 đảo vàng ruộm cùng hải sản tươi rói, trứng muối và rau củ hạt sen.',
        price: 120000,
        category: 'Cơm & Mì',
        available: true
      },
      {
        name: 'Chè Hạt Sen Long Nhãn Tươi',
        description: 'Vị ngọt thanh tao từ hạt sen Huế bọc trong cùi nhãn lồng tươi mát ướp hoa nhài.',
        price: 45000,
        category: 'Tráng Miệng',
        available: false
      }
    ]
  });

  console.log(`Đã nạp thành công: 2 tài khoản mẫu, ${chefs.count} đầu bếp, ${ingredients.count} nguyên liệu, ${dishes.count} món ăn.`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

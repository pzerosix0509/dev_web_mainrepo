const prisma = require('../config/prisma');

// [GET] /menu - Danh sách món ăn cho khách, có tìm kiếm qua query param `q`
exports.getDishes = async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string'
      ? req.query.q.trim().slice(0, 100)
      : '';

    const dishes = await prisma.dish.findMany({
      where: q
        ? {
            name: {
              contains: q,
              mode: 'insensitive' // Tìm kiếm không phân biệt hoa thường
            }
          }
        : {},
      orderBy: { id: 'desc' }
    });

    res.render('public/menu', {
      title: 'Thực Đơn Nhà Hàng',
      dishes,
      searchQuery: q
    });
  } catch (error) {
    next(error);
  }
};

// [GET] /dishes/:id - Chi tiết một món ăn
exports.getDishDetail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ hoặc không tồn tại.'
      });
    }

    const dish = await prisma.dish.findUnique({
      where: { id }
    });

    if (!dish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Không tìm thấy món ăn mà bạn yêu cầu.'
      });
    }

    res.render('public/dish-detail', {
      title: dish.name,
      dish
    });
  } catch (error) {
    next(error);
  }
};

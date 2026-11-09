const prisma = require('../config/prisma');

// Helper validate và lọc dữ liệu Dish
function validateAndSanitizeDish(body) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const priceRaw = body.price;
  const price = typeof priceRaw === 'string' && priceRaw.trim() !== ''
    ? Number(priceRaw)
    : NaN;
  // Checkbox trong HTML form gửi 'on' khi checked, hoặc boolean/string 'true'
  const available = body.available === 'on' || body.available === 'true' || body.available === true;

  if (!name) {
    errors.push('Tên món ăn không được để trống.');
  }
  if (!description) {
    errors.push('Mô tả món ăn không được để trống.');
  }
  if (!category) {
    errors.push('Danh mục món ăn không được để trống.');
  }
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0) {
    errors.push('Giá món ăn phải là số nguyên hợp lệ lớn hơn hoặc bằng 0.');
  }

  return {
    errors,
    data: {
      name,
      description,
      price,
      category,
      available
    }
  };
}

// [GET] /admin/dishes - Danh sách quản trị món ăn
exports.listDishes = async (req, res, next) => {
  try {
    const dishes = await prisma.dish.findMany({
      orderBy: { id: 'asc' }
    });
    res.render('admin/dishes/index', {
      title: 'Quản Lý Món Ăn',
      dishes
    });
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/dishes/new - Form thêm món ăn mới
exports.renderNewForm = (req, res) => {
  res.render('admin/dishes/form', {
    title: 'Thêm Món Ăn Mới',
    isEdit: false,
    values: { name: '', description: '', price: '', category: '', available: true },
    errors: []
  });
};

// [POST] /admin/dishes - Xử lý tạo mới món ăn
exports.createDish = async (req, res, next) => {
  try {
    const { errors, data } = validateAndSanitizeDish(req.body);

    if (errors.length > 0) {
      return res.status(400).render('admin/dishes/form', {
        title: 'Thêm Món Ăn Mới',
        isEdit: false,
        values: req.body, // Giữ nguyên giá trị người dùng đã nhập
        errors
      });
    }

    // Chỉ truyền các trường đã được whitelist vào database
    await prisma.dish.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        available: data.available
      }
    });

    // Bắt buộc redirect với mã HTTP 303 See Other
    res.redirect(303, '/admin/dishes');
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/dishes/:id/edit - Form sửa món ăn
exports.renderEditForm = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ.'
      });
    }

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Món ăn không tồn tại để chỉnh sửa.'
      });
    }

    res.render('admin/dishes/form', {
      title: `Chỉnh Sửa: ${dish.name}`,
      isEdit: true,
      values: dish,
      errors: []
    });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /admin/dishes/:id - Cập nhật món ăn
exports.updateDish = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ.'
      });
    }

    const existingDish = await prisma.dish.findUnique({ where: { id } });
    if (!existingDish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Món ăn không tồn tại để cập nhật.'
      });
    }

    const { errors, data } = validateAndSanitizeDish(req.body);

    if (errors.length > 0) {
      return res.status(400).render('admin/dishes/form', {
        title: `Chỉnh Sửa: ${req.body.name || existingDish.name}`,
        isEdit: true,
        values: { ...req.body, id },
        errors
      });
    }

    await prisma.dish.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        available: data.available
      }
    });

    res.redirect(303, '/admin/dishes');
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/dishes/:id/delete - Trang xác nhận xóa món ăn
exports.renderDeleteConfirm = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ.'
      });
    }

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Món ăn không tồn tại.'
      });
    }

    res.render('admin/dishes/delete', {
      title: 'Xác Nhận Xóa Món Ăn',
      dish
    });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /admin/dishes/:id - Thực hiện xóa món ăn
exports.deleteDish = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ.'
      });
    }

    const existingDish = await prisma.dish.findUnique({ where: { id } });
    if (!existingDish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Món ăn không tồn tại để xóa.'
      });
    }

    await prisma.dish.delete({ where: { id } });

    res.redirect(303, '/admin/dishes');
  } catch (error) {
    next(error);
  }
};

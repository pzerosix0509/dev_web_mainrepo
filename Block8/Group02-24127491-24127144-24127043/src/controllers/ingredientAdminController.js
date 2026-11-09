const prisma = require('../config/prisma');

function validateAndSanitizeIngredient(body) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';

  if (!name) {
    errors.push('Tên nguyên liệu không được để trống.');
  }
  if (!unit) {
    errors.push('Đơn vị tính không được để trống.');
  }

  return {
    errors,
    data: { name, unit }
  };
}

// [GET] /admin/ingredients
exports.listIngredients = async (req, res, next) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { id: 'asc' }
    });
    res.render('admin/ingredients/index', {
      title: 'Quản Lý Nguyên Liệu',
      ingredients
    });
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/ingredients/new
exports.renderNewForm = (req, res) => {
  res.render('admin/ingredients/form', {
    title: 'Thêm Nguyên Liệu Mới',
    isEdit: false,
    values: { name: '', unit: '' },
    errors: []
  });
};

// [POST] /admin/ingredients
exports.createIngredient = async (req, res, next) => {
  try {
    const { errors, data } = validateAndSanitizeIngredient(req.body);

    if (errors.length > 0) {
      return res.status(400).render('admin/ingredients/form', {
        title: 'Thêm Nguyên Liệu Mới',
        isEdit: false,
        values: req.body,
        errors
      });
    }

    await prisma.ingredient.create({
      data: {
        name: data.name,
        unit: data.unit
      }
    });

    res.redirect(303, '/admin/ingredients');
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/ingredients/:id/edit
exports.renderEditForm = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã nguyên liệu không hợp lệ.'
      });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Nguyên liệu không tồn tại.'
      });
    }

    res.render('admin/ingredients/form', {
      title: `Chỉnh Sửa Nguyên Liệu: ${ingredient.name}`,
      isEdit: true,
      values: ingredient,
      errors: []
    });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /admin/ingredients/:id
exports.updateIngredient = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã nguyên liệu không hợp lệ.'
      });
    }

    const existingIngredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!existingIngredient) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Nguyên liệu không tồn tại để cập nhật.'
      });
    }

    const { errors, data } = validateAndSanitizeIngredient(req.body);

    if (errors.length > 0) {
      return res.status(400).render('admin/ingredients/form', {
        title: `Chỉnh Sửa Nguyên Liệu: ${req.body.name || existingIngredient.name}`,
        isEdit: true,
        values: { ...req.body, id },
        errors
      });
    }

    await prisma.ingredient.update({
      where: { id },
      data: {
        name: data.name,
        unit: data.unit
      }
    });

    res.redirect(303, '/admin/ingredients');
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/ingredients/:id/delete
exports.renderDeleteConfirm = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã nguyên liệu không hợp lệ.'
      });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Nguyên liệu không tồn tại.'
      });
    }

    res.render('admin/ingredients/delete', {
      title: 'Xác Nhận Xóa Nguyên Liệu',
      ingredient
    });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /admin/ingredients/:id
exports.deleteIngredient = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã nguyên liệu không hợp lệ.'
      });
    }

    const existingIngredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!existingIngredient) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Nguyên liệu không tồn tại để xóa.'
      });
    }

    await prisma.ingredient.delete({ where: { id } });

    res.redirect(303, '/admin/ingredients');
  } catch (error) {
    next(error);
  }
};

const prisma = require('../config/prisma');

function validateAndSanitizeChef(body) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const specialty = typeof body.specialty === 'string' ? body.specialty.trim() : '';

  if (!name) {
    errors.push('Tên đầu bếp không được để trống.');
  }
  if (!specialty) {
    errors.push('Chuyên môn của đầu bếp không được để trống.');
  }

  return {
    errors,
    data: { name, specialty }
  };
}

// [GET] /admin/chefs
exports.listChefs = async (req, res, next) => {
  try {
    const chefs = await prisma.chef.findMany({
      orderBy: { id: 'asc' }
    });
    res.render('admin/chefs/index', {
      title: 'Quản Lý Đầu Bếp',
      chefs
    });
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/chefs/new
exports.renderNewForm = (req, res) => {
  res.render('admin/chefs/form', {
    title: 'Thêm Đầu Bếp Mới',
    isEdit: false,
    values: { name: '', specialty: '' },
    errors: []
  });
};

// [POST] /admin/chefs
exports.createChef = async (req, res, next) => {
  try {
    const { errors, data } = validateAndSanitizeChef(req.body);

    if (errors.length > 0) {
      return res.status(400).render('admin/chefs/form', {
        title: 'Thêm Đầu Bếp Mới',
        isEdit: false,
        values: req.body,
        errors
      });
    }

    await prisma.chef.create({
      data: {
        name: data.name,
        specialty: data.specialty
      }
    });

    res.redirect(303, '/admin/chefs');
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/chefs/:id/edit
exports.renderEditForm = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã đầu bếp không hợp lệ.'
      });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Đầu bếp không tồn tại.'
      });
    }

    res.render('admin/chefs/form', {
      title: `Chỉnh Sửa Đầu Bếp: ${chef.name}`,
      isEdit: true,
      values: chef,
      errors: []
    });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /admin/chefs/:id
exports.updateChef = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã đầu bếp không hợp lệ.'
      });
    }

    const existingChef = await prisma.chef.findUnique({ where: { id } });
    if (!existingChef) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Đầu bếp không tồn tại để cập nhật.'
      });
    }

    const { errors, data } = validateAndSanitizeChef(req.body);

    if (errors.length > 0) {
      return res.status(400).render('admin/chefs/form', {
        title: `Chỉnh Sửa Đầu Bếp: ${req.body.name || existingChef.name}`,
        isEdit: true,
        values: { ...req.body, id },
        errors
      });
    }

    await prisma.chef.update({
      where: { id },
      data: {
        name: data.name,
        specialty: data.specialty
      }
    });

    res.redirect(303, '/admin/chefs');
  } catch (error) {
    next(error);
  }
};

// [GET] /admin/chefs/:id/delete
exports.renderDeleteConfirm = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã đầu bếp không hợp lệ.'
      });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Đầu bếp không tồn tại.'
      });
    }

    res.render('admin/chefs/delete', {
      title: 'Xác Nhận Xóa Đầu Bếp',
      chef
    });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /admin/chefs/:id
exports.deleteChef = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã đầu bếp không hợp lệ.'
      });
    }

    const existingChef = await prisma.chef.findUnique({ where: { id } });
    if (!existingChef) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Đầu bếp không tồn tại để xóa.'
      });
    }

    await prisma.chef.delete({ where: { id } });

    res.redirect(303, '/admin/chefs');
  } catch (error) {
    next(error);
  }
};

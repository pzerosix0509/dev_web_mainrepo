// [GET] / - Nếu chưa đăng nhập thì hiện Landing Page giới thiệu, nếu đã đăng nhập thì hiện Trang Chủ
exports.getLandingOrHome = (req, res) => {
  if (!req.user || req.user.status !== 'active') {
    return res.render('public/landing', {
      title: 'Restaurantly - Tinh Hoa Ẩm Thực Thượng Hạng'
    });
  }

  return res.render('public/home', {
    title: 'Trang Chủ - Restaurantly'
  });
};

// [GET] /home - Trang chủ sau khi đã đăng nhập
exports.getHome = (req, res) => {
  if (!req.user || req.user.status !== 'active') {
    return res.redirect(303, '/login');
  }

  return res.render('public/home', {
    title: 'Trang Chủ - Restaurantly'
  });
};

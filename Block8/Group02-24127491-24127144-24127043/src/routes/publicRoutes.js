const path = require('path');
const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');
const dishPublicController = require('../controllers/dishPublicController');
const { requireAuth } = require('../middlewares/authMiddleware');

// [GET] /presentation - Trang trình bày kiến thức & giải pháp Block 8 (Xác thực tài khoản trên SSR)
router.get(['/presentation', '/presentation.html'], (req, res) => {
  return res.sendFile(path.join(__dirname, '../../presentation.html'));
});

// [GET] / - Landing Page giới thiệu (nếu chưa đăng nhập) hoặc Trang chủ (nếu đã đăng nhập)
router.get('/', homeController.getLandingOrHome);

// [GET] /home - Trang chủ sau khi đăng nhập (Yêu cầu đăng nhập, chưa đăng nhập chuyển 303 tới /login)
router.get('/home', requireAuth, homeController.getHome);

// Cụm danh sách và chi tiết món ăn (Yêu cầu đăng nhập theo Slide 54 & 60; chưa đăng nhập chuyển 303 tới /login)
router.get('/menu', requireAuth, dishPublicController.getDishes);
router.get('/menu/:id', requireAuth, dishPublicController.getDishDetail);

// Route tương thích với URL /dishes
router.get('/dishes', requireAuth, (req, res) => {
  const query = typeof req.query.q === 'string' && req.query.q.trim()
    ? `?q=${encodeURIComponent(req.query.q)}`
    : '';
  return res.redirect(303, `/menu${query}`);
});

router.get('/dishes/:id', requireAuth, (req, res) => {
  return res.redirect(303, `/menu/${encodeURIComponent(req.params.id)}`);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 0. Làm mới thử thách CAPTCHA SVG
router.get('/captcha/refresh', authController.refreshCaptcha);

// 1. Đăng ký & Kích hoạt tài khoản bằng OTP
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);

router.get('/activate', authController.getActivate);
router.post('/activate', authController.postActivate);
router.post('/activate/resend', authController.postResendOtp);

// Tương thích đường dẫn cũ
router.get('/verify-email', (req, res) => {
  return res.redirect(303, '/activate');
});

// 2. Đăng nhập SSR (chống Brute-force + CAPTCHA)
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// 3. Đăng xuất SSR (POST /logout là chuẩn chính, hỗ trợ thêm GET fallback)
router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

// 4. Quên mật khẩu & Đặt lại mật khẩu bằng Reset Token (hỗ trợ cả /forgot, /reset và /forgot-password, /reset-password)
router.get('/forgot', authController.getForgotPassword);
router.post('/forgot', authController.postForgotPassword);
router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);

router.get('/reset', authController.getResetPassword);
router.post('/reset', authController.postResetPassword);
router.get('/reset-password', authController.getResetPassword);
router.post('/reset-password', authController.postResetPassword);

module.exports = router;

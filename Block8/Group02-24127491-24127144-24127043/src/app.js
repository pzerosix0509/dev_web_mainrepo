const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
require('dotenv').config();

const PrismaSessionStore = require('./config/sessionStore');
const { ensureCsrfToken, verifyCsrfToken } = require('./middlewares/csrfMiddleware');
const { restoreIdentity, requireAuth } = require('./middlewares/authMiddleware');

const publicRoutes = require('./routes/publicRoutes');
const authRoutes = require('./routes/authRoutes');
const dishAdminRoutes = require('./routes/dishAdminRoutes');
const chefAdminRoutes = require('./routes/chefAdminRoutes');
const ingredientAdminRoutes = require('./routes/ingredientAdminRoutes');

const app = express();

// Cấu hình View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Cấu hình Static Files (CSS, hình ảnh)
app.use(express.static(path.join(__dirname, '../public')));

// Parse dữ liệu từ HTML form thuần (application/x-www-form-urlencoded) và JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình method-override để nhận diện ?_method=PATCH và ?_method=DELETE
app.use(methodOverride('_method'));

// Cấu hình Persistent Session Store lưu trong PostgreSQL qua Prisma (Slide 49, 52, 60)
const sessionStore = new PrismaSessionStore({
  ttlMs: 12 * 60 * 60 * 1000
});

app.use(
  session({
    name: 'sid',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'restaurantly_luxury_session_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60 * 1000
    }
  })
);

// Middleware tạo và xác minh CSRF Token cho mọi form thay đổi dữ liệu (Slide 36, 52, 60)
app.use(ensureCsrfToken);
app.use(verifyCsrfToken);

// Middleware khôi phục danh tính từ Session Store và chặn tài khoản pending (Slide 32, 54)
app.use(restoreIdentity);

// Đăng ký routes xác thực và trang công khai
app.use('/', authRoutes);
app.use('/', publicRoutes);

// Bảo vệ toàn bộ cụm CRUD bằng middleware requireAuth (chưa đăng nhập chuyển 303 tới /login - Slide 54, 60)
app.use('/admin', requireAuth, dishAdminRoutes);
app.use('/admin', requireAuth, chefAdminRoutes);
app.use('/admin', requireAuth, ingredientAdminRoutes);

// Xử lý 404 Not Found cho mọi URL không khớp
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Không tìm thấy trang',
    message: 'Trang bạn đang truy cập không tồn tại hoặc đã bị xóa.'
  });
});

// Middleware xử lý lỗi hệ thống tập trung (500)
app.use((err, req, res, next) => {
  console.error('Server Internal Error:', err.message);
  res.status(500).render('500', {
    title: '500 - Lỗi máy chủ',
    message: 'Đã xảy ra sự cố từ máy chủ. Vui lòng thử lại sau.'
  });
});

module.exports = app;

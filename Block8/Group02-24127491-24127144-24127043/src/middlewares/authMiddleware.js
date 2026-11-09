/**
 * authMiddleware.js
 * 1. restoreIdentity: Middleware khôi phục danh tính từ Session Store (Slide 32)
 *    - Đối chiếu userId trong session với bản ghi User trong Database.
 *    - Nếu tài khoản không tồn tại hoặc đang ở trạng thái `pending` (chưa kích hoạt), lập tức hủy session.
 * 2. requireAuth: Middleware bảo vệ toàn bộ cụm CRUD (Slide 54, 60)
 *    - Chưa đăng nhập hoặc tài khoản chưa `active` -> Chuyển hướng 303 tới `/login`.
 */

const prisma = require('../config/prisma');

async function restoreIdentity(req, res, next) {
  res.locals.currentPath = req.path;
  res.locals.currentUser = null;
  res.locals.isAdmin = false;
  res.locals.userRole = 'guest';

  try {
    const sessionUser = req.session ? req.session.user : null;
    if (!sessionUser || !sessionUser.id) {
      req.user = null;
      return next();
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: Number(sessionUser.id) }
    });

    // Chặn tài khoản không tồn tại hoặc tài khoản đang ở trạng thái pending
    const isActive = dbUser && dbUser.status === 'active';
    if (!isActive) {
      req.user = null;
      return req.session.destroy(() => {
        res.clearCookie('sid', { path: '/', httpOnly: true, sameSite: 'lax' });
        res.clearCookie('restaurantly.sid', { path: '/', httpOnly: true, sameSite: 'lax' });
        return next();
      });
    }

    const identity = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status
    };

    req.user = identity;
    req.session.user = identity;
    res.locals.currentUser = identity;
    res.locals.isAdmin = String(dbUser.role).toLowerCase() === 'admin';
    res.locals.userRole = String(dbUser.role).toLowerCase();

    return next();
  } catch (err) {
    return next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user || req.user.status !== 'active') {
    return res.redirect(303, '/login');
  }
  return next();
}

module.exports = {
  restoreIdentity,
  requireAuth
};

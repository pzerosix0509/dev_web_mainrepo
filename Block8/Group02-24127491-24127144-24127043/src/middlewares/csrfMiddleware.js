/**
 * csrfMiddleware.js
 * Biện pháp phòng chống tấn công Cross-Site Request Forgery (CSRF) (Slide 36, 52, 60):
 * 1. Synchronizer Token Pattern: Gắn csrfToken ngẫu nhiên vào Session và nhúng vào mọi form POST/PATCH/DELETE qua trường ẩn `_csrf`.
 * 2. Kiểm tra Origin / Referer Header kết hợp đối chiếu `_csrf` token tại Server trước khi thực thi mọi thao tác đổi dữ liệu.
 */

const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureCsrfToken(req, res, next) {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
  } else {
    res.locals.csrfToken = '';
  }
  next();
}

function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // 1. Kiểm tra Origin header nếu trình duyệt gửi kèm (chặn request từ trang web/origin khác)
  // Lưu ý: Các trang đặt header Referrer-Policy: no-referrer (như GET /reset) sẽ khiến trình duyệt gửi Origin: "null"
  const origin = req.get('origin');
  const host = req.get('host');
  if (origin && origin !== 'null' && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return res.status(403).render('403', {
          title: '403 - Yêu cầu bị từ chối (CSRF)',
          message: 'Yêu cầu gửi dữ liệu từ nguồn bên ngoài (Cross-Origin) đã bị chặn bởi chính sách bảo vệ CSRF.'
        });
      }
    } catch {
      return res.status(403).render('403', {
        title: '403 - Yêu cầu bị từ chối (CSRF)',
        message: 'Header Origin không hợp lệ.'
      });
    }
  }

  // 2. Kiểm tra Synchronizer CSRF Token trong body hoặc header
  const sessionToken = req.session ? req.session.csrfToken : null;
  const submittedToken =
    (req.body && typeof req.body._csrf === 'string' ? req.body._csrf : null) ||
    req.get('x-csrf-token');

  if (!sessionToken || !submittedToken || sessionToken !== submittedToken) {
    return res.status(403).render('403', {
      title: '403 - Yêu cầu bị từ chối (CSRF)',
      message: 'Phiên biểu mẫu không hợp lệ hoặc thiếu mã bảo mật CSRF (_csrf). Vui lòng tải lại trang và thử lại.'
    });
  }

  next();
}

module.exports = {
  ensureCsrfToken,
  verifyCsrfToken
};

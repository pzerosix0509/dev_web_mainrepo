/**
 * authController.js
 * Xử lý toàn bộ nghiệp vụ Xác thực tài khoản trên SSR theo chuẩn Block 8:
 * 1. Đăng ký tài khoản (POST /register):
 *    - Xác minh CAPTCHA tại server trước khi băm mật khẩu, tạo user hoặc gửi OTP
 *    - Chuẩn hóa email (lưu cả rawEmail và email chuẩn hóa), tạo user trạng thái `pending`, role mặc định `viewer` (bỏ qua role trong body)
 *    - Phản hồi giống hệt nhau cho email mới và email đã tồn tại (chống User Enumeration)
 * 2. Kích hoạt bằng OTP qua email (GET/POST /activate, POST /activate/resend):
 *    - OTP 6 chữ số ngẫu nhiên, chỉ lưu bản băm (otpHash) trong bảng ActivationChallenge, gắn purpose='activation', hạn 10 phút, tối đa 5 lần thử
 *    - Gửi lại OTP có thời gian chờ 60s, ghi đè otpHash mới nhưng KHÔNG đặt lại số lần thử (attempts) về 0; quá giới hạn trả HTTP 429
 *    - Kích hoạt thành công cập nhật status='active', emailVerifiedAt=now(), usedAt=now() trong 1 giao dịch nguyên tử; không tự đăng nhập
 * 3. Đăng nhập SSR (GET/POST /login):
 *    - Chống Brute-force theo email chuẩn hóa và IP (lưu trong bảng LoginAttempt)
 *    - Từ 3 lần sai: bắt buộc giải CAPTCHA hợp lệ trước bước kiểm tra password
 *    - Đủ 10 lần sai: khóa tạm 5 phút, trả về trang HTTP 429 dù password và CAPTCHA đúng
 *    - Đăng nhập đúng: xóa bộ đếm theo email (giữ giới hạn IP), sinh sid mới (regenerate), lưu Session vào PostgreSQL, redirect 303
 * 4. Đăng xuất (POST /logout):
 *    - Hủy bản ghi session trong Database trước, xóa cookie `sid`, redirect 303 tới /login
 * 5. Quên & Đặt lại mật khẩu (GET/POST /forgot, GET/POST /reset):
 *    - POST /forgot trả cùng nội dung và HTTP 200 cho email có và không có; giới hạn tần suất (quá hạn trả 429)
 *    - GET /reset chỉ hiện form (không tiêu thụ token), đặt Referrer-Policy: no-referrer
 *    - POST /reset cập nhật passwordHash, đánh dấu usedAt, hủy toàn bộ session cũ của user, gửi email thông báo; không tự đăng nhập
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { createCaptchaChallenge, verifyCaptchaChallenge } = require('../utils/captcha');
const {
  getLoginProtectionState,
  recordFailedLogin,
  clearEmailLoginAttempts,
  checkAndIncrementForgotRateLimit,
  checkAndIncrementRegisterRateLimit
} = require('../utils/loginRateLimiter');
const {
  sendActivationOtpEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail
} = require('../utils/mailer');

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000;          // Hạn OTP: 10 phút
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;      // Thời gian chờ gửi lại OTP: 60 giây
const MAX_OTP_ATTEMPTS = 5;                    // Tối đa 5 lần nhập sai OTP
const MAX_OTP_RESENDS = 5;                     // Tối đa 5 lần gửi lại OTP
const OTP_LOCKOUT_MS = 15 * 60 * 1000;         // Khóa thử OTP 15 phút khi vượt giới hạn
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;  // Hạn Reset Token: 15 phút

const GENERIC_REGISTER_NOTICE =
  'Nếu địa chỉ email hợp lệ và chưa được kích hoạt, hệ thống đã gửi mã OTP gồm 6 chữ số đến hộp thư của bạn. Vui lòng nhập mã OTP bên dưới để hoàn tất kích hoạt.';
const GENERIC_OTP_ERROR =
  'INVALID_OTP: Mã OTP không hợp lệ, đã hết hạn hoặc đã được sử dụng.';
const GENERIC_FORGOT_NOTICE =
  'Nếu email đã đăng ký, hướng dẫn đặt lại mật khẩu đã được gửi.';

function normalizeEmail(rawEmail) {
  return String(rawEmail || '').trim().toLowerCase();
}

function hashValue(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function generateSixDigitOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function validatePasswordRules(password) {
  if (!password || typeof password !== 'string' || password.length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Mật khẩu phải bao gồm cả chữ cái và chữ số.';
  }
  return null;
}

// =========================================================================
// 0. API LÀM MỚI CAPTCHA (GET /captcha/refresh)
// =========================================================================

exports.refreshCaptcha = async (req, res, next) => {
  try {
    const allowedPurposes = new Set(['register', 'login', 'forgot']);
    const purpose = allowedPurposes.has(req.query.purpose) ? req.query.purpose : 'register';
    const captcha = await createCaptchaChallenge(purpose, req.sessionID);
    return res.json({
      challengeId: captcha.challengeId,
      siteKey: captcha.siteKey
    });
  } catch (err) {
    return next(err);
  }
};

// =========================================================================
// 1. ĐĂNG KÝ TÀI KHOẢN (GET /register, POST /register)
// =========================================================================

exports.getRegister = async (req, res, next) => {
  try {
    const captcha = await createCaptchaChallenge('register', req.sessionID);
    return res.render('public/register', {
      title: 'Đăng Ký Tài Khoản - Restaurantly',
      errors: [],
      errorCode: null,
      values: {},
      captcha
    });
  } catch (err) {
    return next(err);
  }
};

exports.postRegister = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, challengeId } = req.body;
    const turnstileToken = req.body['cf-turnstile-response'] || req.body.turnstileToken || '';
    // Bỏ qua hoàn toàn trường role nếu client cố tình gửi lên trong form/body (Slide 50, 58)
    const rawEmail = String(email || '').trim();
    const normalizedEmail = normalizeEmail(rawEmail);
    const trimmedName = String(name || '').trim() || (normalizedEmail ? normalizedEmail.split('@')[0] : 'Hội viên');

    // 1. Kiểm tra Rate Limit theo IP
    const rateLimit = await checkAndIncrementRegisterRateLimit(req.ip);
    if (!rateLimit.allowed) {
      return res.status(429).render('429', {
        title: '429 - Quá giới hạn yêu cầu',
        message: 'RATE_LIMITED: Bạn đã gửi quá nhiều yêu cầu đăng ký từ địa chỉ IP này. Vui lòng đợi 5 phút trước khi thử lại.'
      });
    }

    // 2. Xác minh CAPTCHA Cloudflare Turnstile tại server TRƯỚC KHI băm password, tạo user hoặc gửi OTP (Slide 11, 50, 59)
    const captchaResult = await verifyCaptchaChallenge({
      challengeId,
      turnstileToken,
      purpose: 'register',
      sessionId: req.sessionID,
      remoteip: req.ip
    });

    if (!captchaResult.success) {
      const captcha = await createCaptchaChallenge('register', req.sessionID);
      return res.status(400).render('public/register', {
        title: 'Đăng Ký Tài Khoản - Restaurantly',
        errors: [captchaResult.message],
        errorCode: 'VALIDATION_FAILED',
        values: { name: trimmedName, email: rawEmail },
        captcha
      });
    }

    // 3. Validate dữ liệu đầu vào
    const errors = [];
    if (!trimmedName || trimmedName.length < 2) {
      errors.push('Họ và tên phải có ít nhất 2 ký tự.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      errors.push('Địa chỉ email không đúng định dạng hợp lệ.');
    }

    const pwdError = validatePasswordRules(password);
    if (pwdError) {
      errors.push(pwdError);
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      errors.push('Mật khẩu xác nhận không khớp.');
    }

    if (errors.length > 0) {
      const captcha = await createCaptchaChallenge('register', req.sessionID);
      return res.status(400).render('public/register', {
        title: 'Đăng Ký Tài Khoản - Restaurantly',
        errors: [`VALIDATION_FAILED: ${errors.join(' ')}`],
        errorCode: 'VALIDATION_FAILED',
        values: { name: trimmedName, email: rawEmail },
        captcha
      });
    }

    // 4. Kiểm tra tài khoản đã tồn tại trên bản chuẩn hóa email chưa (Slide 10, 20, 50)
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { activationChallenge: true }
    });

    if (!existingUser) {
      // Email mới: Băm mật khẩu với bcrypt (Salt rounds = 10), tạo user trạng thái pending, role mặc định viewer
      const passwordHash = await bcrypt.hash(password, 10);
      const otpCode = generateSixDigitOtp();
      const otpHash = hashValue(otpCode);
      const now = new Date();

      const newUser = await prisma.user.create({
        data: {
          name: trimmedName,
          email: normalizedEmail,
          rawEmail,
          passwordHash,
          role: 'viewer',
          status: 'pending',
          isVerified: false,
          emailVerifiedAt: null,
          activationChallenge: {
            create: {
              purpose: 'activation',
              otpHash,
              expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
              attempts: 0,
              resendCount: 0,
              lockedUntil: null,
              lastSentAt: now,
              usedAt: null
            }
          }
        }
      });

      await sendActivationOtpEmail(newUser.email, newUser.name, otpCode);
    }
    // Nếu email đã có tài khoản: KHÔNG tạo bản ghi thứ hai, tài khoản không đổi, phản hồi giống hệt email mới (Slide 10, 20, 50)

    return res.status(200).render('public/activate', {
      title: 'Kích Hoạt Tài Khoản (OTP) - Restaurantly',
      email: normalizedEmail,
      errors: [],
      infoMessage: GENERIC_REGISTER_NOTICE
    });
  } catch (err) {
    return next(err);
  }
};

// =========================================================================
// 2. KÍCH HOẠT TÀI KHOẢN QUA MÃ OTP (GET/POST /activate, POST /activate/resend)
// =========================================================================

exports.getActivate = (req, res) => {
  const email = normalizeEmail(req.query.email || '');
  return res.render('public/activate', {
    title: 'Kích Hoạt Tài Khoản (OTP) - Restaurantly',
    email,
    errors: [],
    infoMessage: null
  });
};

exports.postActivate = async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const otpInput = String(req.body.otp || '').trim();
    const now = new Date();

    if (!normalizedEmail) {
      return res.status(200).render('public/activate', {
        title: 'Kích Hoạt Tài Khoản (OTP) - Restaurantly',
        email: '',
        errors: [GENERIC_OTP_ERROR],
        infoMessage: null
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { activationChallenge: true }
    });

    const challenge = user ? user.activationChallenge : null;

    // Kiểm tra khóa tạm / vượt quá giới hạn thử (Slide 20, 51, 58 -> Trang 429)
    if (challenge) {
      const isCurrentlyLocked =
        (challenge.lockedUntil && new Date(challenge.lockedUntil) > now) ||
        challenge.attempts >= MAX_OTP_ATTEMPTS;

      if (isCurrentlyLocked) {
        if (!challenge.lockedUntil || new Date(challenge.lockedUntil) <= now) {
          await prisma.activationChallenge.update({
            where: { id: challenge.id },
            data: { lockedUntil: new Date(now.getTime() + OTP_LOCKOUT_MS) }
          });
        }
        return res.status(429).render('429', {
          title: '429 - Quá giới hạn thử OTP',
          message: 'RATE_LIMITED: Bạn đã vượt quá giới hạn số lần thử mã OTP kích hoạt. Vui lòng đợi 15 phút hoặc thử lại sau.'
        });
      }
    }

    // Cùng lúc phải đúng: tài khoản pending, purpose là activation, chưa hết hạn, chưa dùng, chưa vượt giới hạn thử, hash khớp (Slide 18)
    const isOtpFormatValid = /^\d{6}$/.test(otpInput);
    const isValid =
      Boolean(user) &&
      user.status === 'pending' &&
      Boolean(challenge) &&
      challenge.purpose === 'activation' &&
      challenge.usedAt === null &&
      now <= new Date(challenge.expiresAt) &&
      challenge.attempts < MAX_OTP_ATTEMPTS &&
      isOtpFormatValid &&
      hashValue(otpInput) === challenge.otpHash;

    if (!isValid) {
      if (user && user.status === 'pending' && challenge) {
        const nextAttempts = challenge.attempts + 1;
        const lockedUntil =
          nextAttempts >= MAX_OTP_ATTEMPTS ? new Date(now.getTime() + OTP_LOCKOUT_MS) : challenge.lockedUntil;

        await prisma.activationChallenge.update({
          where: { id: challenge.id },
          data: {
            attempts: nextAttempts,
            lockedUntil
          }
        });
      }

      // Sai, hết hạn, đã dùng đều hiện cùng một thông báo INVALID_OTP (Slide 18, 20, 51, 58)
      return res.status(200).render('public/activate', {
        title: 'Kích Hoạt Tài Khoản (OTP) - Restaurantly',
        email: normalizedEmail,
        errors: [GENERIC_OTP_ERROR],
        infoMessage: null
      });
    }

    // Đúng: Đặt active, ghi emailVerifiedAt, đánh dấu usedAt trong một thao tác nguyên tử (Slide 18)
    const activated = await prisma.$transaction(async (tx) => {
      const consumeResult = await tx.activationChallenge.updateMany({
        where: {
          id: challenge.id,
          usedAt: null,
          attempts: { lt: MAX_OTP_ATTEMPTS }
        },
        data: {
          usedAt: now
        }
      });

      if (consumeResult.count === 0) {
        return false;
      }

      const userUpdate = await tx.user.updateMany({
        where: {
          id: user.id,
          status: 'pending'
        },
        data: {
          status: 'active',
          isVerified: true,
          emailVerifiedAt: now
        }
      });

      return userUpdate.count === 1;
    });

    if (!activated) {
      return res.status(200).render('public/activate', {
        title: 'Kích Hoạt Tài Khoản (OTP) - Restaurantly',
        email: normalizedEmail,
        errors: [GENERIC_OTP_ERROR],
        infoMessage: null
      });
    }

    // Kích hoạt xong: KHÔNG tự đăng nhập, chuyển tới trang đăng nhập (Slide 21, 51, 58)
    return res.redirect(303, '/login?activated=true');
  } catch (err) {
    return next(err);
  }
};

exports.postResendOtp = async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const now = new Date();

    if (!normalizedEmail) {
      return res.status(200).render('public/activate', {
        title: 'Kích Hoạt Tài Khoản (OTP) - Restaurantly',
        email: '',
        errors: [],
        infoMessage: GENERIC_REGISTER_NOTICE
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { activationChallenge: true }
    });

    if (user && user.status === 'pending' && user.activationChallenge) {
      const challenge = user.activationChallenge;

      // Kiểm tra vượt giới hạn thử hoặc giới hạn số lần gửi lại -> trả trang 429 (Slide 19, 20, 51, 58)
      const isLocked =
        (challenge.lockedUntil && new Date(challenge.lockedUntil) > now) ||
        challenge.attempts >= MAX_OTP_ATTEMPTS ||
        challenge.resendCount >= MAX_OTP_RESENDS;

      if (isLocked) {
        return res.status(429).render('429', {
          title: '429 - Quá giới hạn gửi lại OTP',
          message: 'RATE_LIMITED: Tài khoản đã vượt quá giới hạn số lần thử hoặc gửi lại mã OTP. Vui lòng thử lại sau.'
        });
      }

      // Kiểm tra thời gian chờ (cooldown 60s) giữa 2 lần gửi -> chưa đủ thời gian chờ trả trang 429
      const elapsedSinceLastSend = now.getTime() - new Date(challenge.lastSentAt).getTime();
      if (elapsedSinceLastSend < OTP_RESEND_COOLDOWN_MS) {
        return res.status(429).render('429', {
          title: '429 - Vui lòng đợi trước khi gửi lại OTP',
          message: 'RATE_LIMITED: Vui lòng đợi đủ 60 giây giữa hai lần yêu cầu gửi lại mã OTP.'
        });
      }

      // Sinh mã OTP mới ghi đè otpHash cũ; attempts KHÔNG về 0 (Slide 19, 51, 58)
      const newOtpCode = generateSixDigitOtp();
      const newOtpHash = hashValue(newOtpCode);

      await prisma.activationChallenge.update({
        where: { id: challenge.id },
        data: {
          otpHash: newOtpHash,
          expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
          lastSentAt: now,
          usedAt: null,
          resendCount: challenge.resendCount + 1
          // Giữ nguyên attempts! Không reset attempts về 0.
        }
      });

      await sendActivationOtpEmail(user.email, user.name, newOtpCode);
    }

    // Phản hồi giống nhau dù email có tài khoản pending hay không (Slide 19)
    return res.status(200).render('public/activate', {
      title: 'Kích Hoạt Tài Khoản (OTP) - Restaurantly',
      email: normalizedEmail,
      errors: [],
      infoMessage: 'Nếu tài khoản đang chờ kích hoạt, mã OTP mới đã được gửi tới hộp thư của bạn (mã cũ đã bị hủy hiệu lực).'
    });
  } catch (err) {
    return next(err);
  }
};

// =========================================================================
// 3. ĐĂNG NHẬP SSR & CHỐNG BRUTE-FORCE (GET /login, POST /login)
// =========================================================================

exports.getLogin = async (req, res, next) => {
  try {
    let successMessage = null;
    if (req.query.activated === 'true' || req.query.verified === 'true') {
      successMessage = 'Kích hoạt tài khoản thành công! Vui lòng đăng nhập để sử dụng hệ thống.';
    } else if (req.query.reset === 'success') {
      successMessage = 'Đặt lại mật khẩu mới thành công! Các phiên đăng nhập cũ đã bị hủy, vui lòng đăng nhập lại.';
    } else if (req.query.logout === 'true') {
      successMessage = 'Bạn đã đăng xuất khỏi hệ thống an toàn.';
    }

    const prefillEmail = normalizeEmail(req.query.email || '');
    const captcha = await createCaptchaChallenge('login', req.sessionID);

    return res.render('public/login', {
      title: 'Đăng Nhập - Restaurantly',
      errors: [],
      values: prefillEmail ? { email: prefillEmail } : {},
      successMessage,
      captcha,
      pendingEmail: null
    });
  } catch (err) {
    return next(err);
  }
};

exports.postLogin = async (req, res, next) => {
  try {
    const { email, password, challengeId } = req.body;
    const turnstileToken = req.body['cf-turnstile-response'] || req.body.turnstileToken || '';
    const normalizedEmail = normalizeEmail(email);

    // Bước 1: Kiểm tra trạng thái khóa tạm thời (Rate Limit / Lockout) tại Server TRƯỚC TIÊN (Slide 26, 27, 53, 59)
    const protection = await getLoginProtectionState(normalizedEmail, req.ip);
    if (protection.isLocked) {
      return res.status(429).render('429', {
        title: '429 - Tạm khóa đăng nhập',
        message: 'RATE_LIMITED: Đã đạt giới hạn số lần đăng nhập sai (10 lần). Tài khoản hoặc địa chỉ IP này bị tạm từ chối đăng nhập trong 5 phút.'
      });
    }

    // Bước 2: BẮT BUỘC xác minh CAPTCHA Cloudflare Turnstile hợp lệ để chống brute force TRƯỚC KHI kiểm tra password
    const captchaResult = await verifyCaptchaChallenge({
      challengeId,
      turnstileToken,
      purpose: 'login',
      sessionId: req.sessionID,
      remoteip: req.ip
    });

    if (!captchaResult.success) {
      const newCaptcha = await createCaptchaChallenge('login', req.sessionID);
      return res.status(400).render('public/login', {
        title: 'Đăng Nhập - Restaurantly',
        errors: [captchaResult.message],
        values: { email: normalizedEmail },
        successMessage: null,
        captcha: newCaptcha,
        pendingEmail: null
      });
    }

    if (!normalizedEmail || !password) {
      const newCaptcha = await createCaptchaChallenge('login', req.sessionID);
      return res.status(400).render('public/login', {
        title: 'Đăng Nhập - Restaurantly',
        errors: ['Vui lòng nhập đầy đủ địa chỉ email và mật khẩu.'],
        values: { email: normalizedEmail },
        successMessage: null,
        captcha: newCaptcha,
        pendingEmail: null
      });
    }

    // Bước 3: Tra user và kiểm tra passwordHash bằng bcrypt
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    const isPasswordValid = user
      ? await bcrypt.compare(String(password), user.passwordHash)
      : false;

    if (!user || !isPasswordValid) {
      // Tăng bộ đếm sai theo email chuẩn hóa và theo IP
      const afterFail = await recordFailedLogin(normalizedEmail, req.ip);

      if (afterFail.isLocked) {
        return res.status(429).render('429', {
          title: '429 - Tạm khóa đăng nhập',
          message: 'RATE_LIMITED: Đã đạt giới hạn 10 lần đăng nhập sai. Vui lòng đợi 5 phút trước khi thử lại.'
        });
      }

      const nextCaptcha = await createCaptchaChallenge('login', req.sessionID);

      // Cùng một thông báo lỗi chung cho cả email không tồn tại và password sai; giữ email, bỏ password (Slide 24, 52, 60)
      return res.status(400).render('public/login', {
        title: 'Đăng Nhập - Restaurantly',
        errors: ['Email hoặc mật khẩu không chính xác.'],
        values: { email: normalizedEmail },
        successMessage: null,
        captcha: nextCaptcha,
        pendingEmail: null
      });
    }

    // Bước 4: Kiểm tra trạng thái tài khoản (Tài khoản pending đăng nhập đúng password vẫn KHÔNG nhận session - Slide 21, 24, 50, 58)
    if (user.status !== 'active') {
      const nextCaptcha = await createCaptchaChallenge('login', req.sessionID);

      return res.status(403).render('public/login', {
        title: 'Đăng Nhập - Restaurantly',
        errors: ['Tài khoản của bạn đang ở trạng thái chờ kích hoạt (pending). Vui lòng nhập mã OTP kích hoạt trước khi đăng nhập.'],
        values: { email: normalizedEmail },
        successMessage: null,
        captcha: nextCaptcha,
        pendingEmail: normalizedEmail
      });
    }

    // Bước 5: Đăng nhập thành công -> Xóa bộ đếm sai theo email, giữ nguyên giới hạn IP (Slide 26)
    await clearEmailLoginAttempts(normalizedEmail);

    // Sinh sid mới khi login (chống Session Fixation - Slide 33, 52, 60)
    return req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      };

      req.session.csrfToken = crypto.randomBytes(24).toString('hex');

      if (String(user.role).toLowerCase() === 'admin') {
        req.session.cookie.expires = false;
        req.session.cookie.maxAge = null;
      } else {
        req.session.cookie.maxAge = TWELVE_HOURS_MS;
      }

      return req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.redirect(303, '/menu');
      });
    });
  } catch (err) {
    return next(err);
  }
};

// =========================================================================
// 4. ĐĂNG XUẤT SSR (POST /logout)
// =========================================================================

exports.logout = (req, res, next) => {
  if (!req.session) {
    res.clearCookie('sid', { path: '/', httpOnly: true, sameSite: 'lax' });
    res.clearCookie('restaurantly.sid', { path: '/', httpOnly: true, sameSite: 'lax' });
    return res.redirect(303, '/login?logout=true');
  }

  return req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('sid', { path: '/', httpOnly: true, sameSite: 'lax' });
    res.clearCookie('restaurantly.sid', { path: '/', httpOnly: true, sameSite: 'lax' });
    return res.redirect(303, '/login?logout=true');
  });
};

// =========================================================================
// 5. QUÊN MẬT KHẨU & ĐẶT LẠI MẬT KHẨU (GET/POST /forgot, GET/POST /reset)
// =========================================================================

exports.getForgotPassword = (req, res) => {
  return res.render('public/forgot-password', {
    title: 'Quên Mật Khẩu - Restaurantly',
    errors: [],
    values: {},
    successMessage: null
  });
};

exports.postForgotPassword = async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);

    // 1. Kiểm tra giới hạn số yêu cầu /forgot theo email và theo IP (Slide 42, 55, 61 -> Trang 429)
    const rateLimit = await checkAndIncrementForgotRateLimit(normalizedEmail, req.ip);
    if (!rateLimit.allowed) {
      return res.status(429).render('429', {
        title: '429 - Quá giới hạn yêu cầu khôi phục mật khẩu',
        message: 'RATE_LIMITED: Bạn đã gửi quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng đợi 5 phút trước khi thử lại.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return res.status(400).render('public/forgot-password', {
        title: 'Quên Mật Khẩu - Restaurantly',
        errors: ['Vui lòng nhập địa chỉ email đúng định dạng.'],
        values: { email: normalizedEmail },
        successMessage: null
      });
    }

    // 2. Tra user theo email chuẩn hóa
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (user && user.status === 'active') {
      const now = new Date();
      // Yêu cầu mới làm các token chưa dùng trước đó của user hết hiệu lực (Slide 41)
      await prisma.passwordReset.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashValue(rawToken);

      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(now.getTime() + RESET_TOKEN_EXPIRY_MS),
          usedAt: null
        }
      });

      const resetUrl = `${req.protocol}://${req.get('host')}/reset?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    }

    // 3. Phản hồi 200 với thông báo chung GIỐNG HỆT NHAU cho cả email có và không có trong users (Slide 42, 55, 61)
    return res.status(200).render('public/forgot-password', {
      title: 'Quên Mật Khẩu - Restaurantly',
      errors: [],
      values: {},
      successMessage: GENERIC_FORGOT_NOTICE
    });
  } catch (err) {
    return next(err);
  }
};

exports.getResetPassword = async (req, res, next) => {
  try {
    // Đặt Referrer-Policy: no-referrer để token trên URL không rò qua header Referer (Slide 44)
    res.set('Referrer-Policy', 'no-referrer');

    const rawToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    if (!rawToken) {
      return res.status(400).render('public/forgot-password', {
        title: 'Quên Mật Khẩu - Restaurantly',
        errors: ['Liên kết đặt lại mật khẩu không dùng được (thiếu hoặc sai token).'],
        values: {},
        successMessage: null
      });
    }

    const tokenHash = hashValue(rawToken);
    const record = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    // Kiểm tra trạng thái token: sai/không có, đã dùng, hoặc hết hạn (Slide 45)
    if (!record || record.usedAt !== null || new Date() > new Date(record.expiresAt)) {
      return res.status(400).render('public/forgot-password', {
        title: 'Quên Mật Khẩu - Restaurantly',
        errors: ['Liên kết đặt lại mật khẩu không dùng được (không hợp lệ, đã hết hạn hoặc đã được sử dụng).'],
        values: {},
        successMessage: null
      });
    }

    // GET /reset chỉ hiện form, KHÔNG tiêu thụ token (usedAt vẫn rỗng - Slide 44, 55, 61)
    return res.status(200).render('public/reset-password', {
      title: 'Đặt Lại Mật Khẩu Mới - Restaurantly',
      token: rawToken,
      errors: []
    });
  } catch (err) {
    return next(err);
  }
};

exports.postResetPassword = async (req, res, next) => {
  try {
    res.set('Referrer-Policy', 'no-referrer');

    const rawToken = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const { password, confirmPassword } = req.body;

    if (!rawToken) {
      return res.status(400).render('public/forgot-password', {
        title: 'Quên Mật Khẩu - Restaurantly',
        errors: ['Liên kết đặt lại mật khẩu không dùng được.'],
        values: {},
        successMessage: null
      });
    }

    const tokenHash = hashValue(rawToken);
    const record = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!record || record.usedAt !== null || new Date() > new Date(record.expiresAt)) {
      return res.status(400).render('public/forgot-password', {
        title: 'Quên Mật Khẩu - Restaurantly',
        errors: ['Liên kết đặt lại mật khẩu không dùng được (không hợp lệ, đã hết hạn hoặc đã được sử dụng).'],
        values: {},
        successMessage: null
      });
    }

    const errors = [];
    const pwdError = validatePasswordRules(password);
    if (pwdError) {
      errors.push(pwdError);
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      errors.push('Mật khẩu xác nhận không khớp.');
    }

    if (errors.length > 0) {
      return res.status(400).render('public/reset-password', {
        title: 'Đặt Lại Mật Khẩu Mới - Restaurantly',
        token: rawToken,
        errors
      });
    }

    const newPasswordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    // Thực hiện trong 1 transaction nguyên tử (Slide 46, 55, 61):
    // 1. Tiêu thụ token hiện tại (usedAt = now)
    // 2. Vô hiệu hóa các token chưa dùng khác của user
    // 3. Cập nhật passwordHash mới
    // 4. Hủy toàn bộ các session cũ của user trong bảng Session
    const updated = await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordReset.updateMany({
        where: {
          id: record.id,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      });

      if (consumed.count === 0) {
        return false;
      }

      await tx.passwordReset.updateMany({
        where: {
          userId: record.userId,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      });

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: now
        }
      });

      await tx.session.deleteMany({
        where: { userId: record.userId }
      });

      return true;
    });

    if (!updated) {
      return res.status(400).render('public/forgot-password', {
        title: 'Quên Mật Khẩu - Restaurantly',
        errors: ['Liên kết đặt lại mật khẩu đã được sử dụng.'],
        values: {},
        successMessage: null
      });
    }

    // Xóa bộ đếm đăng nhập sai của user (nếu có) và gửi email thông báo password đã đổi (Slide 46)
    await clearEmailLoginAttempts(record.user.email);
    await sendPasswordChangedEmail(record.user.email, record.user.name);

    // Nếu trình duyệt hiện tại đang giữ session của user này thì hủy luôn và xóa cookie
    if (req.session && req.session.user && req.session.user.id === record.userId) {
      return req.session.destroy(() => {
        res.clearCookie('sid', { path: '/', httpOnly: true, sameSite: 'lax' });
        res.clearCookie('restaurantly.sid', { path: '/', httpOnly: true, sameSite: 'lax' });
        return res.redirect(303, '/login?reset=success');
      });
    }

    // Không tự đăng nhập; chuyển tới trang đăng nhập (Slide 46, 55, 61)
    return res.redirect(303, '/login?reset=success');
  } catch (err) {
    return next(err);
  }
};

/**
 * loginRateLimiter.js
 * Quản lý bộ đếm đăng nhập sai và giới hạn tần suất (Rate Limiting / Brute-force Protection) lưu bền vững trong Database
 * Chính sách công bố (Slide 26, 49, 53, 55, 59, 61):
 * - Cửa sổ đếm sai (Window): 15 phút
 * - Ngưỡng yêu cầu CAPTCHA khi đăng nhập: Từ 3 lần sai trở lên (theo email chuẩn hóa hoặc theo IP)
 * - Ngưỡng khóa tạm thời (Lockout) khi đăng nhập: Đủ 10 lần sai theo email (hoặc 20 lần sai theo IP) -> Khóa 5 phút (HTTP 429)
 * - Đăng nhập thành công: Xóa bộ đếm sai theo email, giữ nguyên bộ đếm theo IP
 * - Quên mật khẩu (/forgot): Giới hạn tối đa 5 yêu cầu / 15 phút theo email và 10 yêu cầu / 15 phút theo IP -> Quá giới hạn trả HTTP 429
 * - Đăng ký (/register): Giới hạn tối đa 10 yêu cầu / 15 phút theo IP -> Quá giới hạn trả HTTP 429
 */

const prisma = require('../config/prisma');

const WINDOW_MS = 15 * 60 * 1000;          // Cửa sổ đếm 15 phút
const LOCKOUT_MS = 5 * 60 * 1000;          // Thời gian chờ khóa tạm 5 phút
const CAPTCHA_THRESHOLD = 3;               // Từ 3 lần sai yêu cầu CAPTCHA
const EMAIL_LOCKOUT_THRESHOLD = 10;        // Đủ 10 lần sai theo email -> khóa 5 phút (429)
const IP_LOCKOUT_THRESHOLD = 20;           // Đủ 20 lần sai theo IP -> khóa 5 phút (429)
const FORGOT_EMAIL_MAX_ATTEMPTS = 5;       // Tối đa 5 lần /forgot cho 1 email trong 15 phút
const FORGOT_IP_MAX_ATTEMPTS = 10;         // Tối đa 10 lần /forgot cho 1 IP trong 15 phút
const REGISTER_IP_MAX_ATTEMPTS = 15;       // Tối đa 15 lần /register cho 1 IP trong 15 phút

function normalizeIp(rawIp) {
  if (!rawIp) return '127.0.0.1';
  return String(rawIp).replace(/^::ffff:/, '').trim() || '127.0.0.1';
}

/**
 * Lấy trạng thái bộ đếm hiện tại (tự động reset nếu đã qua cửa sổ 15 phút và hết thời gian khóa)
 */
async function getAttemptRecord(key, keyType, target) {
  const now = new Date();
  const record = await prisma.loginAttempt.findUnique({ where: { key } });

  if (!record) {
    return {
      key,
      keyType,
      target,
      attempts: 0,
      windowStart: now,
      lockedUntil: null,
      isLocked: false
    };
  }

  // Nếu đang bị khóa và thời gian khóa vẫn còn hiệu lực
  if (record.lockedUntil && new Date(record.lockedUntil) > now) {
    return {
      ...record,
      isLocked: true
    };
  }

  // Nếu đã hết thời gian khóa HOẶC đã quá cửa sổ đếm 15 phút -> đặt lại cửa sổ mới
  const windowElapsed = now.getTime() - new Date(record.windowStart).getTime() > WINDOW_MS;
  const lockExpired = record.lockedUntil && new Date(record.lockedUntil) <= now;

  if (windowElapsed || lockExpired) {
    const resetRecord = await prisma.loginAttempt.update({
      where: { key },
      data: {
        attempts: 0,
        windowStart: now,
        lockedUntil: null
      }
    });
    return {
      ...resetRecord,
      isLocked: false
    };
  }

  return {
    ...record,
    isLocked: false
  };
}

/**
 * Kiểm tra trạng thái trước khi xử lý POST /login hoặc GET /login
 */
async function getLoginProtectionState(normalizedEmail, rawIp) {
  const ip = normalizeIp(rawIp);
  const ipState = await getAttemptRecord(`ip:${ip}`, 'ip', ip);
  const emailState = normalizedEmail
    ? await getAttemptRecord(`email:${normalizedEmail}`, 'email', normalizedEmail)
    : { attempts: 0, lockedUntil: null, isLocked: false };

  const isLocked = Boolean(emailState.isLocked || ipState.isLocked);
  const lockedUntil = emailState.isLocked ? emailState.lockedUntil : ipState.lockedUntil;
  const requiresCaptcha =
    emailState.attempts >= CAPTCHA_THRESHOLD || ipState.attempts >= CAPTCHA_THRESHOLD;

  return {
    isLocked,
    lockedUntil,
    requiresCaptcha,
    emailAttempts: emailState.attempts,
    ipAttempts: ipState.attempts
  };
}

/**
 * Ghi nhận 1 lần đăng nhập thất bại (tăng bộ đếm theo email chuẩn hóa và theo IP)
 */
async function recordFailedLogin(normalizedEmail, rawIp) {
  const now = new Date();
  const ip = normalizeIp(rawIp);

  // 1. Cập nhật bộ đếm theo IP
  const currentIp = await getAttemptRecord(`ip:${ip}`, 'ip', ip);
  const nextIpAttempts = currentIp.attempts + 1;
  const ipLockedUntil =
    nextIpAttempts >= IP_LOCKOUT_THRESHOLD ? new Date(now.getTime() + LOCKOUT_MS) : null;

  await prisma.loginAttempt.upsert({
    where: { key: `ip:${ip}` },
    update: {
      attempts: nextIpAttempts,
      lockedUntil: ipLockedUntil
    },
    create: {
      key: `ip:${ip}`,
      keyType: 'ip',
      target: ip,
      attempts: nextIpAttempts,
      windowStart: now,
      lockedUntil: ipLockedUntil
    }
  });

  // 2. Cập nhật bộ đếm theo Email chuẩn hóa
  let nextEmailAttempts = 0;
  let emailLockedUntil = null;

  if (normalizedEmail) {
    const currentEmail = await getAttemptRecord(`email:${normalizedEmail}`, 'email', normalizedEmail);
    nextEmailAttempts = currentEmail.attempts + 1;
    emailLockedUntil =
      nextEmailAttempts >= EMAIL_LOCKOUT_THRESHOLD ? new Date(now.getTime() + LOCKOUT_MS) : null;

    await prisma.loginAttempt.upsert({
      where: { key: `email:${normalizedEmail}` },
      update: {
        attempts: nextEmailAttempts,
        lockedUntil: emailLockedUntil
      },
      create: {
        key: `email:${normalizedEmail}`,
        keyType: 'email',
        target: normalizedEmail,
        attempts: nextEmailAttempts,
        windowStart: now,
        lockedUntil: emailLockedUntil
      }
    });
  }

  const isLocked = Boolean(emailLockedUntil || ipLockedUntil);
  const requiresCaptcha =
    nextEmailAttempts >= CAPTCHA_THRESHOLD || nextIpAttempts >= CAPTCHA_THRESHOLD;

  return {
    isLocked,
    lockedUntil: emailLockedUntil || ipLockedUntil,
    requiresCaptcha,
    emailAttempts: nextEmailAttempts,
    ipAttempts: nextIpAttempts
  };
}

/**
 * Khi đăng nhập thành công: Xóa bộ đếm sai theo email, KHÔNG xóa giới hạn theo IP (Slide 26)
 */
async function clearEmailLoginAttempts(normalizedEmail) {
  if (!normalizedEmail) return;
  await prisma.loginAttempt.deleteMany({
    where: { key: `email:${normalizedEmail}` }
  });
}

/**
 * Kiểm tra và ghi nhận giới hạn tần suất cho chức năng Quên mật khẩu (/forgot)
 */
async function checkAndIncrementForgotRateLimit(normalizedEmail, rawIp) {
  const now = new Date();
  const ip = normalizeIp(rawIp);

  const ipState = await getAttemptRecord(`forgot_ip:${ip}`, 'forgot_ip', ip);
  const emailState = normalizedEmail
    ? await getAttemptRecord(`forgot_email:${normalizedEmail}`, 'forgot_email', normalizedEmail)
    : { attempts: 0, isLocked: false };

  if (ipState.isLocked || emailState.isLocked) {
    return { allowed: false, lockedUntil: emailState.lockedUntil || ipState.lockedUntil };
  }

  const nextIpAttempts = ipState.attempts + 1;
  const ipLock = nextIpAttempts > FORGOT_IP_MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS) : null;

  await prisma.loginAttempt.upsert({
    where: { key: `forgot_ip:${ip}` },
    update: { attempts: nextIpAttempts, lockedUntil: ipLock },
    create: {
      key: `forgot_ip:${ip}`,
      keyType: 'forgot_ip',
      target: ip,
      attempts: nextIpAttempts,
      windowStart: now,
      lockedUntil: ipLock
    }
  });

  if (normalizedEmail) {
    const nextEmailAttempts = emailState.attempts + 1;
    const emailLock =
      nextEmailAttempts > FORGOT_EMAIL_MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS) : null;

    await prisma.loginAttempt.upsert({
      where: { key: `forgot_email:${normalizedEmail}` },
      update: { attempts: nextEmailAttempts, lockedUntil: emailLock },
      create: {
        key: `forgot_email:${normalizedEmail}`,
        keyType: 'forgot_email',
        target: normalizedEmail,
        attempts: nextEmailAttempts,
        windowStart: now,
        lockedUntil: emailLock
      }
    });

    if (emailLock || ipLock) {
      return { allowed: false, lockedUntil: emailLock || ipLock };
    }
  } else if (ipLock) {
    return { allowed: false, lockedUntil: ipLock };
  }

  return { allowed: true };
}

/**
 * Kiểm tra và ghi nhận giới hạn tần suất cho chức năng Đăng ký (/register) theo IP
 */
async function checkAndIncrementRegisterRateLimit(rawIp) {
  const now = new Date();
  const ip = normalizeIp(rawIp);

  const ipState = await getAttemptRecord(`register_ip:${ip}`, 'register_ip', ip);
  if (ipState.isLocked) {
    return { allowed: false, lockedUntil: ipState.lockedUntil };
  }

  const nextAttempts = ipState.attempts + 1;
  const lock = nextAttempts > REGISTER_IP_MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS) : null;

  await prisma.loginAttempt.upsert({
    where: { key: `register_ip:${ip}` },
    update: { attempts: nextAttempts, lockedUntil: lock },
    create: {
      key: `register_ip:${ip}`,
      keyType: 'register_ip',
      target: ip,
      attempts: nextAttempts,
      windowStart: now,
      lockedUntil: lock
    }
  });

  if (lock) {
    return { allowed: false, lockedUntil: lock };
  }

  return { allowed: true };
}

module.exports = {
  WINDOW_MS,
  LOCKOUT_MS,
  CAPTCHA_THRESHOLD,
  EMAIL_LOCKOUT_THRESHOLD,
  IP_LOCKOUT_THRESHOLD,
  getLoginProtectionState,
  recordFailedLogin,
  clearEmailLoginAttempts,
  checkAndIncrementForgotRateLimit,
  checkAndIncrementRegisterRateLimit
};

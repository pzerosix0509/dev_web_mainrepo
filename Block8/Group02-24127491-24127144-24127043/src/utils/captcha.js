/**
 * captcha.js
 * Xác thực chống Bot bằng Cloudflare Turnstile kết hợp quản lý trạng thái thử thách tại Server (Slide 14, 15, 49, 53, 59):
 * 1. Frontend hiển thị widget Cloudflare Turnstile (cf-turnstile) và lấy token `cf-turnstile-response`.
 * 2. Backend gọi API `https://challenges.cloudflare.com/turnstile/v0/siteverify` bằng Secret Key của Server để xác minh token.
 * 3. Đồng thời quản lý bản ghi `CaptchaChallenge` (`challengeId`, `purpose`, `sessionId`, `expiresAt`, `usedAt`) trong PostgreSQL
 *    để chống dùng lại (Replay), dùng quá hạn hoặc dùng sai mục đích (register vs login vs forgot).
 */

const crypto = require('crypto');
const prisma = require('../config/prisma');

const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';
const DEFAULT_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';
const CAPTCHA_EXPIRY_MS = 5 * 60 * 1000; // 5 phút

function getTurnstileSiteKey() {
  return process.env.TURNSTILE_SITE_KEY || DEFAULT_TEST_SITE_KEY;
}

function getTurnstileSecretKey() {
  return process.env.TURNSTILE_SECRET_KEY || DEFAULT_TEST_SECRET_KEY;
}

/**
 * Tạo thử thách CAPTCHA mới gắn với mục đích (register | login | forgot) và phiên hiện tại
 */
async function createCaptchaChallenge(purpose = 'register', sessionId = null) {
  if (sessionId) {
    await prisma.captchaChallenge.updateMany({
      where: {
        sessionId,
        purpose,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    });
  }

  const challengeId = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + CAPTCHA_EXPIRY_MS);

  await prisma.captchaChallenge.create({
    data: {
      challengeId,
      answerHash: 'cloudflare_turnstile',
      sessionId: sessionId || null,
      purpose,
      expiresAt,
      usedAt: null
    }
  });

  return {
    challengeId,
    siteKey: getTurnstileSiteKey(),
    isTestKey: getTurnstileSiteKey() === DEFAULT_TEST_SITE_KEY,
    expiresAt
  };
}

/**
 * Gọi API siteverify của Cloudflare Turnstile tại Backend
 */
async function verifyWithCloudflare(turnstileToken, remoteip = '') {
  if (!turnstileToken || typeof turnstileToken !== 'string' || !turnstileToken.trim()) {
    return {
      success: false,
      code: 'TURNSTILE_MISSING',
      message: 'Vui lòng hoàn thành xác thực chống bot (Cloudflare Turnstile).'
    };
  }

  const secretKey = getTurnstileSecretKey();

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', turnstileToken.trim());
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    const data = await response.json();

    if (data && data.success) {
      return { success: true };
    }

    return {
      success: false,
      code: 'TURNSTILE_INVALID',
      message: 'Xác thực chống bot Cloudflare Turnstile không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.'
    };
  } catch (err) {
    console.error('Turnstile Verification Error:', err.message);
    return {
      success: false,
      code: 'TURNSTILE_ERROR',
      message: 'Không thể kết nối đến máy chủ xác thực Cloudflare Turnstile. Vui lòng thử lại.'
    };
  }
}

/**
 * Xác minh Cloudflare Turnstile Token kết hợp kiểm tra challengeId (chống dùng lại, quá hạn, sai mục đích)
 */
async function verifyCaptchaChallenge({
  challengeId,
  turnstileToken,
  purpose,
  sessionId = null,
  remoteip = ''
}) {
  if (!turnstileToken || typeof turnstileToken !== 'string' || !turnstileToken.trim()) {
    return {
      success: false,
      code: 'CAPTCHA_MISSING',
      message: 'Vui lòng hoàn thành xác thực chống bot (Cloudflare Turnstile).'
    };
  }

  // Nếu có challengeId đi kèm, kiểm tra tính hợp lệ, đúng mục đích, còn hạn và chưa từng sử dụng
  if (challengeId && typeof challengeId === 'string') {
    const record = await prisma.captchaChallenge.findUnique({
      where: { challengeId: challengeId.trim() }
    });

    if (!record) {
      return {
        success: false,
        code: 'CAPTCHA_INVALID',
        message: 'Phiên xác thực chống bot không hợp lệ. Vui lòng tải lại trang.'
      };
    }

    if (record.usedAt !== null) {
      return {
        success: false,
        code: 'CAPTCHA_ALREADY_USED',
        message: 'Token xác thực chống bot này đã được sử dụng. Vui lòng thực hiện lại.'
      };
    }

    if (new Date() > new Date(record.expiresAt)) {
      await prisma.captchaChallenge.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() }
      });
      return {
        success: false,
        code: 'CAPTCHA_EXPIRED',
        message: 'Phiên xác thực chống bot đã hết hạn. Vui lòng thử lại.'
      };
    }

    if (record.purpose !== purpose) {
      await prisma.captchaChallenge.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() }
      });
      return {
        success: false,
        code: 'CAPTCHA_WRONG_PURPOSE',
        message: 'Token xác thực chống bot không đúng mục đích sử dụng.'
      };
    }

    if (record.sessionId && sessionId && record.sessionId !== sessionId) {
      await prisma.captchaChallenge.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() }
      });
      return {
        success: false,
        code: 'CAPTCHA_SESSION_MISMATCH',
        message: 'Phiên xác thực chống bot không khớp.'
      };
    }

    // Tiêu thụ challengeId nguyên tử (chỉ 1 lần dùng duy nhất)
    const consumed = await prisma.captchaChallenge.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    if (consumed.count === 0) {
      return {
        success: false,
        code: 'CAPTCHA_ALREADY_USED',
        message: 'Token xác thực chống bot này đã được sử dụng.'
      };
    }
  } else {
    return {
      success: false,
      code: 'CAPTCHA_MISSING_CHALLENGE',
      message: 'Thiếu mã phiên xác thực chống bot (challengeId).'
    };
  }

  // Xác minh token với máy chủ Cloudflare Turnstile
  return verifyWithCloudflare(turnstileToken, remoteip);
}

module.exports = {
  getTurnstileSiteKey,
  createCaptchaChallenge,
  verifyCaptchaChallenge
};

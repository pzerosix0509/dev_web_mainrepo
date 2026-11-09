/**
 * mailer.js
 * Dịch vụ gửi Email sử dụng Nodemailer:
 * 1. sendActivationOtpEmail: Gửi mã OTP 6 chữ số kích hoạt tài khoản (Slide 17, 51)
 * 2. sendPasswordResetEmail: Gửi liên kết đặt lại mật khẩu /reset?token=... (Slide 41, 55)
 * 3. sendPasswordChangedEmail: Gửi thông báo mật khẩu đã được thay đổi (Slide 46)
 *
 * Bảo mật (Slide 17, 51, 57):
 * - Tuyệt đối KHÔNG ghi mã OTP hay Reset Token dạng rõ (plaintext) ra console log hoặc trả trong HTTP response.
 */

const nodemailer = require('nodemailer');

let cachedEtherealTransporter = null;

async function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (user && pass && !user.includes('your-email')) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: { user, pass }
    });
  }

  if (!cachedEtherealTransporter) {
    const testAccount = await nodemailer.createTestAccount();
    cachedEtherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }

  return cachedEtherealTransporter;
}

/**
 * 1. Gửi mã OTP 6 chữ số để kích hoạt tài khoản
 */
async function sendActivationOtpEmail(toEmail, name, otpCode) {
  const from = process.env.EMAIL_FROM || '"Restaurantly Luxury" <no-reply@restaurantly.vn>';

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0b09; color: #bab8b2; border: 1px solid #cda45e; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #1a1814; padding: 28px; text-align: center; border-bottom: 1px solid #28251f;">
        <h1 style="margin: 0; color: #ffffff; font-family: Georgia, serif; letter-spacing: 1px;">
          Restaurantly<span style="color: #cda45e;">.</span>
        </h1>
        <p style="margin: 6px 0 0; font-size: 12px; color: #cda45e; text-transform: uppercase; letter-spacing: 2px;">
          Mã OTP Kích Hoạt Tài Khoản
        </p>
      </div>
      <div style="padding: 32px 28px;">
        <h2 style="color: #ffffff; margin-top: 0;">Xin chào ${name || 'Quý khách'},</h2>
        <p style="line-height: 1.6; font-size: 15px;">
          Cảm ơn bạn đã đăng ký tài khoản tại <strong>Restaurantly</strong>. Vui lòng nhập mã OTP gồm 6 chữ số dưới đây vào trang kích hoạt để xác minh địa chỉ email của bạn:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background-color: #151410; border: 2px dashed #cda45e; color: #cda45e; padding: 16px 36px; border-radius: 12px; font-family: monospace; font-weight: bold; font-size: 32px; letter-spacing: 8px;">
            ${otpCode}
          </div>
        </div>
        <p style="font-size: 12px; color: #7f7c75; margin-top: 24px; border-top: 1px solid #28251f; padding-top: 16px;">
          Mã OTP này chỉ dùng <strong>một lần</strong> và có hiệu lực trong vòng <strong>10 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
        </p>
      </div>
    </div>
  `;

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from,
    to: toEmail,
    subject: '[Restaurantly] Mã OTP kích hoạt tài khoản của bạn',
    html
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[MAILER] Đã gửi email OTP kích hoạt tới ${toEmail} | Hộp thư Ethereal: ${previewUrl}`);
  } else {
    console.log(`[MAILER] Đã gửi email OTP kích hoạt tới ${toEmail}`);
  }

  return { success: true, previewUrl: previewUrl || null };
}

/**
 * 2. Gửi email chứa link đặt lại mật khẩu (/reset?token=...)
 */
async function sendPasswordResetEmail(toEmail, name, resetUrl) {
  const from = process.env.EMAIL_FROM || '"Restaurantly Luxury" <no-reply@restaurantly.vn>';

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0b09; color: #bab8b2; border: 1px solid #cda45e; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #1a1814; padding: 28px; text-align: center; border-bottom: 1px solid #28251f;">
        <h1 style="margin: 0; color: #ffffff; font-family: Georgia, serif; letter-spacing: 1px;">
          Restaurantly<span style="color: #cda45e;">.</span>
        </h1>
        <p style="margin: 6px 0 0; font-size: 12px; color: #cda45e; text-transform: uppercase; letter-spacing: 2px;">
          Yêu Cầu Đặt Lại Mật Khẩu
        </p>
      </div>
      <div style="padding: 32px 28px;">
        <h2 style="color: #ffffff; margin-top: 0;">Xin chào ${name || 'Quý khách'},</h2>
        <p style="line-height: 1.6; font-size: 15px;">
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${toEmail}</strong>. Nhấn vào nút bên dưới để mở biểu mẫu đặt mật khẩu mới:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background-color: #cda45e; color: #0c0b09; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">
            Đặt Lại Mật Khẩu Mới
          </a>
        </div>
        <p style="font-size: 13px; color: #8c8983; line-height: 1.6;">
          Hoặc mở liên kết sau trong trình duyệt:<br>
          <a href="${resetUrl}" style="color: #cda45e; word-break: break-all;">${resetUrl}</a>
        </p>
        <p style="font-size: 12px; color: #7f7c75; margin-top: 24px; border-top: 1px solid #28251f; padding-top: 16px;">
          Liên kết này chỉ sử dụng <strong>một lần</strong> và có hiệu lực trong <strong>15 phút</strong>. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
        </p>
      </div>
    </div>
  `;

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from,
    to: toEmail,
    subject: '[Restaurantly] Hướng dẫn đặt lại mật khẩu',
    html
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[MAILER] Đã gửi email đặt lại mật khẩu tới ${toEmail} | Hộp thư Ethereal: ${previewUrl}`);
  } else {
    console.log(`[MAILER] Đã gửi email đặt lại mật khẩu tới ${toEmail}`);
  }

  return { success: true, previewUrl: previewUrl || null };
}

/**
 * 3. Gửi email thông báo mật khẩu đã được thay đổi (Slide 46: không gửi password trong email)
 */
async function sendPasswordChangedEmail(toEmail, name) {
  const from = process.env.EMAIL_FROM || '"Restaurantly Luxury" <no-reply@restaurantly.vn>';

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0b09; color: #bab8b2; border: 1px solid #cda45e; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #1a1814; padding: 28px; text-align: center; border-bottom: 1px solid #28251f;">
        <h1 style="margin: 0; color: #ffffff; font-family: Georgia, serif; letter-spacing: 1px;">
          Restaurantly<span style="color: #cda45e;">.</span>
        </h1>
        <p style="margin: 6px 0 0; font-size: 12px; color: #cda45e; text-transform: uppercase; letter-spacing: 2px;">
          Thông Báo Bảo Mật Tài Khoản
        </p>
      </div>
      <div style="padding: 32px 28px;">
        <h2 style="color: #ffffff; margin-top: 0;">Xin chào ${name || 'Quý khách'},</h2>
        <p style="line-height: 1.6; font-size: 15px;">
          Mật khẩu cho tài khoản <strong>${toEmail}</strong> tại Restaurantly vừa được thay đổi thành công vào lúc ${new Date().toLocaleString('vi-VN')}. Toàn bộ các phiên đăng nhập trước đó của bạn đã được thu hồi để bảo đảm an toàn.
        </p>
        <p style="font-size: 12px; color: #7f7c75; margin-top: 24px; border-top: 1px solid #28251f; padding-top: 16px;">
          Nếu bạn không thực hiện thao tác này, vui lòng liên hệ quản trị viên ngay lập tức.
        </p>
      </div>
    </div>
  `;

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: '[Restaurantly] Mật khẩu tài khoản của bạn đã được thay đổi',
      html
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[MAILER] Đã gửi thông báo đổi mật khẩu tới ${toEmail} | Hộp thư Ethereal: ${previewUrl}`);
    }
    return { success: true };
  } catch {
    return { success: false };
  }
}

module.exports = {
  sendActivationOtpEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail
};

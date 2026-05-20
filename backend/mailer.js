const nodemailer = require('nodemailer');

console.log('📧 SMTP Config:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS ? '***SET***' : '***NOT SET***'
});

// ── Transporter ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // True for 465 (SSL), False for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Verify SMTP connection at startup (IMPORTANT DEBUG) ─────
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ SMTP connection failed:', error.message);
  } else {
    console.log('✅ SMTP server is ready to send emails');
  }
});

// ── Welcome Email ───────────────────────────────────────────
async function sendWelcomeEmail({ to, name, username, password }) {
  try {
    const result = await transporter.sendMail({
      from: `"Azur Hotels BI" <${process.env.SMTP_USER}>`,
      to,
      subject: '🏨 Bienvenue sur Azur Hotels BI – Vos identifiants',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
          <div style="background:#1a3c5e;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">🏨 Azur Hotels BI</h1>
          </div>
          <div style="padding:28px;">
            <p>Bonjour <strong>${name}</strong>,</p>
            <p>Votre compte a été créé avec succès.</p>

            <div style="background:#f5f8fc;border-left:4px solid #1a3c5e;padding:16px;margin:20px 0;">
              <p><strong>Identifiant :</strong> ${username}</p>
              <p><strong>Mot de passe :</strong> ${password}</p>
            </div>

            <p style="text-align:center;margin:30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color:#1a3c5e;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Accéder à la plateforme</a>
            </p>

            <p style="color:#e74c3c;font-size:13px;">
              ⚠️
            </p>

            <p style="font-size:12px;color:#888;margin-top:30px;">
              Email automatique – ne pas répondre.
            </p>
          </div>
        </div>
      `,
    });

    console.log('✅ Welcome email sent:', result.messageId);
  } catch (err) {
    console.error('❌ Welcome email failed:', err.message);
    throw err;
  }
}

// ── Reset Password Email ─────────────────────────────────────
async function sendNewPasswordEmail({ to, name, username, newPassword }) {
  try {
    const result = await transporter.sendMail({
      from: `"Azur Hotels BI" <${process.env.SMTP_USER}>`,
      to,
      subject: '🔑 Nouveau mot de passe envoyé – Azur Hotels BI',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
          <div style="background:#1a3c5e;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">🏨 Azur Hotels BI</h1>
          </div>
          <div style="padding:28px;">
            <p>Bonjour <strong>${name}</strong>,</p>
            <p>Votre nouveau mot de passe a été envoyé :</p>

            <div style="background:#f5f8fc;border-left:4px solid #e67e22;padding:16px;margin:20px 0;">
              <p><strong>Identifiant :</strong> ${username}</p>
              <p><strong>Mot de passe temporaire :</strong> ${newPassword}</p>
            </div>

            <p style="text-align:center;margin:30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color:#e67e22;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;">Se connecter</a>
            </p>

            <p style="font-size:13px;color:#666;margin-top:16px;">
              Utilisez ce mot de passe pour vous connecter.
            </p>

            <p style="font-size:12px;color:#888;margin-top:30px;">
              Email automatique – ne pas répondre.
            </p>
          </div>
        </div>
      `,
    });

    console.log('✅ Reset email sent:', result.messageId);
  } catch (err) {
    console.error('❌ Reset email failed:', err.message);
    throw err;
  }
}

module.exports = {
  sendWelcomeEmail,
  sendNewPasswordEmail,
};
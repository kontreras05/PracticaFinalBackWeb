import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const createTransporter = () => {
  if (!config.smtp.host || !config.smtp.user) return null;
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
};

export const sendVerificationCode = async (email, code) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[MAIL] Código de verificación para ${email}: ${code}`);
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Tu código de verificación — BildyApp',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Verifica tu cuenta</h2>
        <p>Usa el siguiente código para verificar tu dirección de correo electrónico:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center">${code}</p>
        <p style="color:#888;font-size:12px">Este código expira en 24 horas.</p>
      </div>
    `,
  });
};

export const sendInvitationCode = async (email, name, code) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[MAIL] Invitación para ${email} (${name}): código ${code}`);
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Has sido invitado a BildyApp',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Bienvenido a BildyApp, ${name}</h2>
        <p>Has sido invitado a unirte a tu empresa. Usa el siguiente código para acceder:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center">${code}</p>
        <p style="color:#888;font-size:12px">Este código expira en 24 horas.</p>
      </div>
    `,
  });
};

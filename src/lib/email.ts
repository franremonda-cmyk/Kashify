import nodemailer from "nodemailer";

// Envío de email vía Gmail SMTP (App Password). Solo para mails internos al
// operador (ej. el digest semanal de Neo). No-op si faltan las envs (dev/build
// no rompe): loguea y sigue.
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("sendEmail: faltan GMAIL_USER / GMAIL_APP_PASSWORD → no se envía");
    return false;
  }
  try {
    const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transport.sendMail({ from: `Neo · Kashify <${user}>`, to, subject, html });
    return true;
  } catch (e) {
    console.error("sendEmail failed:", e);
    return false;
  }
}

import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.EMAIL_SERVER_HOST
const SMTP_PORT = Number(process.env.EMAIL_SERVER_PORT || 587)
const SMTP_USER = process.env.EMAIL_SERVER_USER
const SMTP_PASS = process.env.EMAIL_SERVER_PASSWORD
const FROM = process.env.EMAIL_FROM || 'noreply@involtcad.ru'

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS)
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
})

export interface SendEmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error('SMTP не настроен. Заполните EMAIL_SERVER_HOST, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD.')
  }

  await transporter.sendMail({
    from: FROM,
    to,
    subject,
    text,
    html,
  })
}

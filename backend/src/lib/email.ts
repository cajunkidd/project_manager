import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "../prisma";

let cachedTransport: Transporter | null = null;

export function emailEnabled(): boolean {
  return !!process.env.SMTP_HOST;
}

function transport(): Transporter | null {
  if (!emailEnabled()) return null;
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return cachedTransport;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const t = transport();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? "Project Manager <noreply@example.com>",
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[email] send failed", e);
    return false;
  }
}

export async function sendEmailToUser(
  userId: string,
  msg: Omit<EmailMessage, "to">,
): Promise<boolean> {
  if (!emailEnabled()) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, isActive: true, emailNotificationsEnabled: true },
  });
  if (!user || !user.isActive || !user.emailNotificationsEnabled) return false;
  return sendEmail({ to: user.email, ...msg });
}

export function appLink(path: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:5173";
  return base.replace(/\/$/, "") + path;
}

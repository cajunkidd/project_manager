import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private prisma: PrismaService) {
    this.from = process.env.SMTP_FROM ?? 'Project Manager <noreply@example.com>';
    this.appUrl = process.env.APP_URL ?? 'http://localhost:5173';

    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
    }
  }

  isAvailable(): boolean {
    return !!this.transporter;
  }

  async send(options: SendOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.debug(`[email disabled] Would send "${options.subject}" to ${options.to}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text ?? this.htmlToText(options.html),
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`Failed to send email to ${options.to}: ${e.message}`);
      return false;
    }
  }

  private htmlToText(html: string): string {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
  }

  private layout(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
    const cta = ctaUrl
      ? `<p style="margin:24px 0;"><a href="${ctaUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${ctaLabel ?? 'View'}</a></p>`
      : '';
    return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
      <h2 style="margin:0 0 16px 0;font-size:18px;">${title}</h2>
      <div style="font-size:14px;line-height:1.6;">${body}</div>
      ${cta}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="font-size:12px;color:#6b7280;">Project Manager · <a href="${this.appUrl}/settings" style="color:#6b7280;">Manage email preferences</a></p>
    </div>`;
  }

  async sendNotification(notification: {
    userId: string;
    title: string;
    message: string;
    entityType?: string | null;
    entityId?: string | null;
  }): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, emailNotifications: true, isActive: true },
    });
    if (!user || !user.isActive || !user.emailNotifications) return false;

    const link = notification.entityType === 'task' && notification.entityId
      ? `${this.appUrl}/tasks/${notification.entityId}`
      : notification.entityType === 'project' && notification.entityId
      ? `${this.appUrl}/projects/${notification.entityId}`
      : undefined;

    const taskToken = notification.entityType === 'task' && notification.entityId
      ? ` [task:${notification.entityId.slice(0, 8)}]`
      : '';

    return this.send({
      to: user.email,
      subject: notification.title + taskToken,
      html: this.layout(notification.title, notification.message, link, 'Open in App'),
    });
  }

  async sendDailyDigest(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, isActive: true, emailDigest: true },
    });
    if (!user || !user.isActive || !user.emailDigest) return false;

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 86_400_000);

    const [overdue, dueSoon, openTasks] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          assignedTo: userId,
          status: { notIn: ['done', 'cancelled'] },
          dueDate: { lt: now },
        },
        select: { id: true, title: true, dueDate: true, priority: true, project: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.task.findMany({
        where: {
          assignedTo: userId,
          status: { notIn: ['done', 'cancelled'] },
          dueDate: { gte: now, lte: weekFromNow },
        },
        select: { id: true, title: true, dueDate: true, priority: true, project: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.task.count({
        where: { assignedTo: userId, status: { notIn: ['done', 'cancelled'] } },
      }),
    ]);

    if (overdue.length === 0 && dueSoon.length === 0) return false;

    const renderRow = (t: any) => `
      <li style="margin:6px 0;">
        <a href="${this.appUrl}/tasks/${t.id}" style="color:#2563eb;text-decoration:none;">${escape(t.title)}</a>
        <span style="color:#6b7280;font-size:12px;"> · ${t.project?.name ?? 'No project'} · due ${new Date(t.dueDate).toLocaleDateString()}</span>
      </li>`;

    const body = `
      <p>Hi ${escape(user.displayName)}, here's your snapshot for today.</p>
      <p style="margin:16px 0 4px 0;font-weight:600;">You have ${openTasks} open task(s).</p>
      ${overdue.length > 0 ? `<h3 style="color:#dc2626;font-size:14px;margin:16px 0 4px 0;">Overdue (${overdue.length})</h3><ul style="padding-left:20px;margin:0;">${overdue.map(renderRow).join('')}</ul>` : ''}
      ${dueSoon.length > 0 ? `<h3 style="font-size:14px;margin:16px 0 4px 0;">Due this week (${dueSoon.length})</h3><ul style="padding-left:20px;margin:0;">${dueSoon.map(renderRow).join('')}</ul>` : ''}`;

    return this.send({
      to: user.email,
      subject: `Daily digest — ${overdue.length} overdue, ${dueSoon.length} due soon`,
      html: this.layout('Your Daily Digest', body, this.appUrl, 'Open Dashboard'),
    });
  }

  async sendDigestToAll(): Promise<{ sent: number; skipped: number }> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, emailDigest: true },
      select: { id: true },
    });
    let sent = 0, skipped = 0;
    for (const u of users) {
      const ok = await this.sendDailyDigest(u.id);
      if (ok) sent++; else skipped++;
    }
    return { sent, skipped };
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

import { prisma } from '../../db/prisma';
import { ValidationError } from '../../utils/errors';
import { tasksService } from '../tasks/tasks.service';
import { getEmailProvider } from './email.provider';

const TASK_OPEN_STATUSES = ['backlog', 'to_do', 'in_progress', 'waiting', 'review'];

export interface InboundEmail {
  from: string;
  to?: string;
  subject: string;
  body: string;
  receivedAt?: Date;
}

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export const emailService = {
  async send(to: string, subject: string, body: string, meta?: Record<string, unknown>) {
    return getEmailProvider().send({ to, subject, body, meta });
  },

  async ingest(email: InboundEmail) {
    if (!email.from) throw new ValidationError('from is required');
    if (!email.subject?.trim()) throw new ValidationError('subject is required');

    await prisma.emailLog.create({
      data: {
        direction: 'inbound',
        fromAddress: email.from,
        toAddress: email.to ?? null,
        subject: email.subject,
        body: email.body,
      },
    });

    const sender = await prisma.user.findUnique({ where: { email: email.from.toLowerCase() } });

    const task = await tasksService.create(
      {
        title: email.subject.trim(),
        description: email.body || null,
        status: 'to_do',
        priority: /(\burgent\b|\basap\b)/i.test(`${email.subject} ${email.body}`)
          ? 'urgent'
          : 'normal',
        assignedToId: sender?.id ?? null,
      },
      sender?.id,
    );

    return { task, recognized: Boolean(sender) };
  },

  async dailyDigestForUser(userId: string, date = new Date()) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ValidationError('Unknown user');

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const now = date;

    const [open, overdue, dueToday, completedYesterday] = await Promise.all([
      prisma.task.count({
        where: {
          assignedToId: userId,
          status: { in: TASK_OPEN_STATUSES },
        },
      }),
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          status: { in: TASK_OPEN_STATUSES },
          dueDate: { lt: now },
        },
        select: { id: true, title: true, dueDate: true },
        take: 20,
      }),
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          status: { in: TASK_OPEN_STATUSES },
          dueDate: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true, title: true, dueDate: true },
        take: 20,
      }),
      prisma.task.count({
        where: {
          assignedToId: userId,
          status: 'done',
          completedAt: {
            gte: new Date(dayStart.getTime() - 24 * 3600 * 1000),
            lt: dayStart,
          },
        },
      }),
    ]);

    const summary = {
      user: { id: user.id, displayName: user.displayName, email: user.email },
      counts: {
        open,
        overdue: overdue.length,
        dueToday: dueToday.length,
        completedYesterday,
      },
      overdue,
      dueToday,
    };

    const subject = `Daily digest — ${dueToday.length} due today, ${overdue.length} overdue`;
    const lines = [
      `Hi ${user.displayName},`,
      '',
      `You have ${open} open task(s).`,
      `${overdue.length} overdue, ${dueToday.length} due today.`,
      '',
      ...(overdue.length ? ['Overdue:', ...overdue.map((t) => ` • ${t.title}`), ''] : []),
      ...(dueToday.length ? ['Due today:', ...dueToday.map((t) => ` • ${t.title}`), ''] : []),
      `Completed yesterday: ${completedYesterday}.`,
    ];
    const body = lines.join('\n');

    await emailService.send(user.email, subject, body, { kind: 'daily_digest', userId });
    return summary;
  },
};

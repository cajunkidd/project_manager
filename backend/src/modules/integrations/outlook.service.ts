import crypto from 'node:crypto';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';

const TASK_OPEN_STATUSES = ['backlog', 'to_do', 'in_progress', 'waiting', 'review'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatIcsDate(date: Date): string {
  return (
    `${date.getUTCFullYear()}` +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldLine(line: string): string {
  // RFC 5545: lines should be folded at 75 octets.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

interface TaskForCalendar {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: Date | null;
  dueDate: Date | null;
  updatedAt: Date;
}

export function tasksToIcs(
  tasks: TaskForCalendar[],
  calendarName: string,
  now: Date = new Date(),
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Project Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];

  for (const t of tasks) {
    if (!t.dueDate && !t.startDate) continue;
    const start = t.startDate ?? t.dueDate ?? now;
    const end = t.dueDate ?? new Date(start.getTime() + 30 * 60_000);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:task-${t.id}@project-manager`);
    lines.push(`DTSTAMP:${formatIcsDate(t.updatedAt)}`);
    lines.push(`DTSTART:${formatIcsDate(start)}`);
    lines.push(`DTEND:${formatIcsDate(end)}`);
    lines.push(foldLine(`SUMMARY:${escapeIcs(t.title)}`));
    if (t.description)
      lines.push(foldLine(`DESCRIPTION:${escapeIcs(t.description)}`));
    lines.push(`STATUS:${t.status === 'done' ? 'COMPLETED' : 'CONFIRMED'}`);
    if (t.priority === 'urgent') lines.push('PRIORITY:1');
    else if (t.priority === 'high') lines.push('PRIORITY:3');
    else if (t.priority === 'low') lines.push('PRIORITY:7');
    else lines.push('PRIORITY:5');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function calendarTokenFor(userId: string): string {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`calendar:${userId}`)
    .digest('base64url')
    .slice(0, 32);
}

export const outlookService = {
  tokenFor(userId: string): string {
    return calendarTokenFor(userId);
  },

  async resolveUser(userId: string, token: string) {
    const expected = calendarTokenFor(userId);
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
      throw new UnauthorizedError('Invalid calendar token');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    return user;
  },

  async buildCalendar(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { in: [...TASK_OPEN_STATUSES, 'done'] },
        OR: [{ dueDate: { not: null } }, { startDate: { not: null } }],
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        dueDate: true,
        updatedAt: true,
      },
      take: 500,
    });
    return tasksToIcs(tasks, `${user.displayName} — Project Manager`);
  },
};

import { prisma } from '../../db/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';

const ENTRY_INCLUDE = {
  task: { select: { id: true, title: true } },
  user: { select: { id: true, displayName: true, email: true } },
} as const;

function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeek(date = new Date()): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

export interface ManualEntryInput {
  taskId: string;
  startedAt: Date;
  endedAt: Date;
  note?: string | null;
}

export interface UpdateEntryInput {
  startedAt?: Date;
  endedAt?: Date;
  note?: string | null;
}

export const timeTrackingService = {
  async start(taskId: string, userId: string, note?: string | null) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task not found');

    const existing = await prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
    });
    if (existing) {
      throw new ConflictError('Another timer is already running for this user');
    }

    return prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        startedAt: new Date(),
        note: note ?? null,
      },
      include: ENTRY_INCLUDE,
    });
  },

  async stop(id: string, userId: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('Time entry not found');
    if (entry.userId !== userId) throw new ForbiddenError();
    if (entry.endedAt) return entry;

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - entry.startedAt.getTime();
    return prisma.timeEntry.update({
      where: { id },
      data: { endedAt, durationMs },
      include: ENTRY_INCLUDE,
    });
  },

  async stopActive(userId: string) {
    const active = await prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
    });
    if (!active) return null;
    return this.stop(active.id, userId);
  },

  async getActive(userId: string) {
    return prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
      include: ENTRY_INCLUDE,
    });
  },

  async listForTask(taskId: string) {
    return prisma.timeEntry.findMany({
      where: { taskId },
      orderBy: { startedAt: 'desc' },
      include: ENTRY_INCLUDE,
    });
  },

  async listForUser(userId: string, opts: { from?: Date; to?: Date } = {}) {
    return prisma.timeEntry.findMany({
      where: {
        userId,
        ...(opts.from || opts.to
          ? {
              startedAt: {
                ...(opts.from ? { gte: opts.from } : {}),
                ...(opts.to ? { lt: opts.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: ENTRY_INCLUDE,
    });
  },

  async createManual(input: ManualEntryInput, userId: string) {
    const task = await prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) throw new NotFoundError('Task not found');
    if (input.endedAt.getTime() <= input.startedAt.getTime()) {
      throw new ValidationError('endedAt must be after startedAt');
    }
    return prisma.timeEntry.create({
      data: {
        taskId: input.taskId,
        userId,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        durationMs: input.endedAt.getTime() - input.startedAt.getTime(),
        note: input.note ?? null,
      },
      include: ENTRY_INCLUDE,
    });
  },

  async update(id: string, input: UpdateEntryInput, userId: string, role: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('Time entry not found');
    if (entry.userId !== userId && role !== 'admin' && role !== 'manager') {
      throw new ForbiddenError();
    }
    const startedAt = input.startedAt ?? entry.startedAt;
    const endedAt = input.endedAt ?? entry.endedAt;
    if (endedAt && endedAt.getTime() <= startedAt.getTime()) {
      throw new ValidationError('endedAt must be after startedAt');
    }
    return prisma.timeEntry.update({
      where: { id },
      data: {
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        note: input.note,
        durationMs: endedAt ? endedAt.getTime() - startedAt.getTime() : null,
      },
      include: ENTRY_INCLUDE,
    });
  },

  async remove(id: string, userId: string, role: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('Time entry not found');
    if (entry.userId !== userId && role !== 'admin' && role !== 'manager') {
      throw new ForbiddenError();
    }
    await prisma.timeEntry.delete({ where: { id } });
  },

  async weeklySummary(filters: { date?: Date; userId?: string } = {}) {
    const now = filters.date ?? new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const rows = await prisma.timeEntry.groupBy({
      by: ['userId'],
      where: {
        startedAt: { gte: weekStart, lt: weekEnd },
        endedAt: { not: null },
        ...(filters.userId ? { userId: filters.userId } : {}),
      },
      _sum: { durationMs: true },
    });

    if (!rows.length) return [];
    const userIds = rows.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows
      .map((r) => ({
        user: userMap.get(r.userId) ?? { id: r.userId, displayName: 'Unknown', email: '' },
        hours: r._sum.durationMs ? Math.round((r._sum.durationMs / 3_600_000) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.hours - a.hours);
  },
};

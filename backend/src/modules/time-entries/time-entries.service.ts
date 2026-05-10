import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const ENTRY_INCLUDE = {
  user: { select: { id: true, displayName: true, email: true } },
  task: { select: { id: true, title: true, projectId: true } },
} as const;

export const timeEntriesService = {
  async start(taskId: string, userId: string, note?: string | null) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
    if (!task) throw new NotFoundError('Task not found');

    const running = await prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
    });
    if (running) {
      throw new ConflictError('You already have a running timer; stop it first.');
    }

    return prisma.timeEntry.create({
      data: { taskId, userId, startedAt: new Date(), note: note ?? null },
      include: ENTRY_INCLUDE,
    });
  },

  async stop(userId: string, now = new Date()) {
    const running = await prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
    });
    if (!running) throw new NotFoundError('No running timer');
    const seconds = Math.max(1, Math.round((now.getTime() - running.startedAt.getTime()) / 1000));
    return prisma.timeEntry.update({
      where: { id: running.id },
      data: { endedAt: now, durationSeconds: seconds },
      include: ENTRY_INCLUDE,
    });
  },

  async getActive(userId: string) {
    return prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
      include: ENTRY_INCLUDE,
    });
  },

  async addManual(input: {
    taskId: string;
    userId: string;
    startedAt: Date;
    endedAt: Date;
    note?: string | null;
  }) {
    if (input.endedAt.getTime() <= input.startedAt.getTime()) {
      throw new ValidationError('endedAt must be after startedAt');
    }
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { id: true },
    });
    if (!task) throw new NotFoundError('Task not found');
    const seconds = Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 1000);
    const created = await prisma.timeEntry.create({
      data: {
        taskId: input.taskId,
        userId: input.userId,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        durationSeconds: seconds,
        note: input.note ?? null,
      },
      include: ENTRY_INCLUDE,
    });
    await activityService.log({
      entityType: 'task',
      entityId: input.taskId,
      action: 'time_logged',
      newValue: { seconds },
      userId: input.userId,
    });
    return created;
  },

  async update(
    id: string,
    actorId: string,
    input: { startedAt?: Date; endedAt?: Date | null; note?: string | null },
  ) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('Entry not found');
    if (entry.userId !== actorId) throw new ValidationError('You can only edit your own entries');

    const startedAt = input.startedAt ?? entry.startedAt;
    const endedAt = input.endedAt === undefined ? entry.endedAt : input.endedAt;
    let durationSeconds = entry.durationSeconds;
    if (endedAt) {
      if (endedAt.getTime() <= startedAt.getTime()) {
        throw new ValidationError('endedAt must be after startedAt');
      }
      durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
    } else {
      durationSeconds = null;
    }
    return prisma.timeEntry.update({
      where: { id },
      data: {
        startedAt,
        endedAt,
        durationSeconds,
        note: input.note === undefined ? entry.note : input.note,
      },
      include: ENTRY_INCLUDE,
    });
  },

  async remove(id: string, actorId: string, actorRole: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('Entry not found');
    if (entry.userId !== actorId && actorRole !== 'admin' && actorRole !== 'manager') {
      throw new ValidationError('You can only remove your own entries');
    }
    await prisma.timeEntry.delete({ where: { id } });
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
        startedAt: opts.from ? { gte: opts.from } : undefined,
        endedAt: opts.to ? { lte: opts.to } : undefined,
      },
      orderBy: { startedAt: 'desc' },
      include: ENTRY_INCLUDE,
    });
  },

  async taskTotal(taskId: string) {
    const agg = await prisma.timeEntry.aggregate({
      where: { taskId, durationSeconds: { not: null } },
      _sum: { durationSeconds: true },
    });
    return agg._sum.durationSeconds ?? 0;
  },

  async projectSummary(projectId: string) {
    const entries = await prisma.timeEntry.findMany({
      where: { task: { projectId }, durationSeconds: { not: null } },
      select: {
        durationSeconds: true,
        userId: true,
        taskId: true,
        user: { select: { id: true, displayName: true, email: true } },
        task: { select: { id: true, title: true } },
      },
    });
    let totalSeconds = 0;
    const byUser = new Map<
      string,
      { user: { id: string; displayName: string; email: string }; seconds: number }
    >();
    const byTask = new Map<string, { task: { id: string; title: string }; seconds: number }>();
    for (const e of entries) {
      const sec = e.durationSeconds ?? 0;
      totalSeconds += sec;
      const u = byUser.get(e.userId) ?? { user: e.user, seconds: 0 };
      u.seconds += sec;
      byUser.set(e.userId, u);
      const t = byTask.get(e.taskId) ?? { task: e.task, seconds: 0 };
      t.seconds += sec;
      byTask.set(e.taskId, t);
    }
    return {
      totalSeconds,
      byUser: Array.from(byUser.values()).sort((a, b) => b.seconds - a.seconds),
      byTask: Array.from(byTask.values()).sort((a, b) => b.seconds - a.seconds),
    };
  },
};

import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';

export interface CreateTimeEntryInput {
  taskId: string;
  minutes: number;
  notes?: string | null;
  occurredAt?: Date;
}

export const timeService = {
  async listForTask(taskId: string) {
    return prisma.timeEntry.findMany({
      where: { taskId },
      orderBy: { occurredAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
  },

  async listForUser(userId: string, from?: Date, to?: Date) {
    return prisma.timeEntry.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              occurredAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
      },
    });
  },

  async create(input: CreateTimeEntryInput, userId: string) {
    if (!Number.isInteger(input.minutes) || input.minutes <= 0) {
      throw new ValidationError('Minutes must be a positive integer');
    }
    const task = await prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) throw new NotFoundError('Task not found');
    return prisma.timeEntry.create({
      data: {
        taskId: input.taskId,
        userId,
        minutes: input.minutes,
        notes: input.notes ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
  },

  async remove(id: string, userId: string, role: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError('Entry not found');
    if (entry.userId !== userId && role !== 'admin' && role !== 'manager') {
      throw new ValidationError('Cannot delete another user\'s time entry');
    }
    await prisma.timeEntry.delete({ where: { id } });
  },

  async taskRollup(taskId: string) {
    const entries = await prisma.timeEntry.findMany({
      where: { taskId },
      include: { user: { select: { id: true, displayName: true } } },
    });
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
    const byUser: Record<string, { user: { id: string; displayName: string }; minutes: number }> = {};
    for (const e of entries) {
      const k = e.userId;
      byUser[k] = byUser[k] ?? { user: e.user, minutes: 0 };
      byUser[k].minutes += e.minutes;
    }
    return { taskId, totalMinutes, byUser: Object.values(byUser) };
  },

  async projectRollup(projectId: string) {
    const entries = await prisma.timeEntry.findMany({
      where: { task: { projectId } },
      include: {
        user: { select: { id: true, displayName: true } },
        task: { select: { id: true, title: true } },
      },
    });
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
    const byUser: Record<string, { user: { id: string; displayName: string }; minutes: number }> = {};
    const byTask: Record<string, { task: { id: string; title: string }; minutes: number }> = {};
    for (const e of entries) {
      byUser[e.userId] = byUser[e.userId] ?? { user: e.user, minutes: 0 };
      byUser[e.userId].minutes += e.minutes;
      byTask[e.taskId] = byTask[e.taskId] ?? { task: e.task, minutes: 0 };
      byTask[e.taskId].minutes += e.minutes;
    }
    return {
      projectId,
      totalMinutes,
      byUser: Object.values(byUser),
      byTask: Object.values(byTask),
    };
  },
};

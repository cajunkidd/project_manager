import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';

export interface CreateInput {
  taskId: string;
  minutes: number;
  description?: string | null;
  billable?: boolean;
  loggedAt?: Date;
}

export interface UpdateInput {
  minutes?: number;
  description?: string | null;
  billable?: boolean;
  loggedAt?: Date;
}

export interface ListFilters {
  userId?: string;
  projectId?: string;
  taskId?: string;
  from?: Date;
  to?: Date;
}

export type SummaryGroupBy = 'user' | 'project' | 'task' | 'day';

const ENTRY_INCLUDE = {
  user: { select: { id: true, displayName: true, email: true } },
  task: { select: { id: true, title: true, projectId: true } },
} as const;

function buildWhere(filters: ListFilters): Prisma.TimeEntryWhereInput {
  const where: Prisma.TimeEntryWhereInput = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.taskId) where.taskId = filters.taskId;
  if (filters.projectId) where.task = { projectId: filters.projectId };
  if (filters.from || filters.to) {
    where.loggedAt = {};
    if (filters.from) where.loggedAt.gte = filters.from;
    if (filters.to) where.loggedAt.lte = filters.to;
  }
  return where;
}

export const timeEntriesService = {
  async create(input: CreateInput, userId: string) {
    if (!input.minutes || input.minutes <= 0) {
      throw new ValidationError('minutes must be greater than 0');
    }
    if (input.minutes > 24 * 60) {
      throw new ValidationError('minutes cannot exceed 24 hours');
    }
    const task = await prisma.task.findUnique({ where: { id: input.taskId } });
    if (!task) throw new NotFoundError('Task not found');
    return prisma.timeEntry.create({
      data: {
        taskId: input.taskId,
        userId,
        minutes: input.minutes,
        description: input.description ?? null,
        billable: input.billable ?? true,
        loggedAt: input.loggedAt ?? new Date(),
      },
      include: ENTRY_INCLUDE,
    });
  },

  async list(filters: ListFilters = {}) {
    return prisma.timeEntry.findMany({
      where: buildWhere(filters),
      orderBy: { loggedAt: 'desc' },
      include: ENTRY_INCLUDE,
      take: 500,
    });
  },

  async getById(id: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id }, include: ENTRY_INCLUDE });
    if (!entry) throw new NotFoundError('Time entry not found');
    return entry;
  },

  async update(id: string, input: UpdateInput, actor: { id: string; role: string }) {
    const entry = await this.getById(id);
    if (entry.userId !== actor.id && actor.role !== 'admin' && actor.role !== 'manager') {
      throw new ForbiddenError('Cannot edit another user’s time entry');
    }
    if (input.minutes !== undefined) {
      if (input.minutes <= 0) throw new ValidationError('minutes must be greater than 0');
      if (input.minutes > 24 * 60) throw new ValidationError('minutes cannot exceed 24 hours');
    }
    return prisma.timeEntry.update({
      where: { id },
      data: input,
      include: ENTRY_INCLUDE,
    });
  },

  async remove(id: string, actor: { id: string; role: string }) {
    const entry = await this.getById(id);
    if (entry.userId !== actor.id && actor.role !== 'admin' && actor.role !== 'manager') {
      throw new ForbiddenError('Cannot delete another user’s time entry');
    }
    await prisma.timeEntry.delete({ where: { id } });
  },

  async summary(groupBy: SummaryGroupBy, filters: ListFilters = {}) {
    const entries = await prisma.timeEntry.findMany({
      where: buildWhere(filters),
      include: {
        user: { select: { id: true, displayName: true, email: true } },
        task: { select: { id: true, title: true, projectId: true, project: { select: { id: true, name: true } } } },
      },
    });

    const buckets = new Map<
      string,
      { key: string; label: string; minutes: number; billableMinutes: number; entries: number }
    >();

    for (const entry of entries) {
      let key: string;
      let label: string;
      if (groupBy === 'user') {
        key = entry.userId;
        label = entry.user.displayName;
      } else if (groupBy === 'project') {
        key = entry.task.projectId ?? 'none';
        label = entry.task.project?.name ?? '(no project)';
      } else if (groupBy === 'task') {
        key = entry.taskId;
        label = entry.task.title;
      } else {
        const d = new Date(entry.loggedAt);
        d.setHours(0, 0, 0, 0);
        key = d.toISOString().slice(0, 10);
        label = key;
      }
      const existing = buckets.get(key);
      if (existing) {
        existing.minutes += entry.minutes;
        if (entry.billable) existing.billableMinutes += entry.minutes;
        existing.entries += 1;
      } else {
        buckets.set(key, {
          key,
          label,
          minutes: entry.minutes,
          billableMinutes: entry.billable ? entry.minutes : 0,
          entries: 1,
        });
      }
    }

    const rows = [...buckets.values()].sort((a, b) =>
      groupBy === 'day' ? a.key.localeCompare(b.key) : b.minutes - a.minutes,
    );
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
    const billableMinutes = entries.reduce((sum, e) => sum + (e.billable ? e.minutes : 0), 0);
    return {
      groupBy,
      rows,
      totals: { entries: entries.length, minutes: totalMinutes, billableMinutes },
    };
  },
};

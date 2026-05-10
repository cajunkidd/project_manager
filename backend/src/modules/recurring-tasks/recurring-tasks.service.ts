import type { RecurringTask } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface CreateRecurringTaskInput {
  name: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  priority?: string;
  assignedToId?: string | null;
  frequency: Frequency;
  interval?: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  dueOffsetDays?: number;
  startAt: Date;
  endAt?: Date | null;
}

export type UpdateRecurringTaskInput = Partial<CreateRecurringTaskInput> & {
  isActive?: boolean;
};

const INCLUDE = {
  project: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, displayName: true, email: true } },
} as const;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function advance(current: Date, rule: Pick<RecurringTask, 'frequency' | 'interval'>): Date {
  const step = Math.max(1, rule.interval);
  switch (rule.frequency) {
    case 'daily':
      return addDays(current, step);
    case 'weekly':
      return addDays(current, 7 * step);
    case 'monthly':
      return addMonths(current, step);
    default:
      throw new ValidationError(`Unsupported frequency: ${rule.frequency}`);
  }
}

function validateRule(input: CreateRecurringTaskInput) {
  if (!['daily', 'weekly', 'monthly'].includes(input.frequency)) {
    throw new ValidationError(`Unsupported frequency: ${input.frequency}`);
  }
  if (input.interval !== undefined && input.interval < 1) {
    throw new ValidationError('interval must be >= 1');
  }
  if (
    input.frequency === 'weekly' &&
    input.dayOfWeek !== undefined &&
    input.dayOfWeek !== null &&
    (input.dayOfWeek < 0 || input.dayOfWeek > 6)
  ) {
    throw new ValidationError('dayOfWeek must be 0-6');
  }
  if (
    input.frequency === 'monthly' &&
    input.dayOfMonth !== undefined &&
    input.dayOfMonth !== null &&
    (input.dayOfMonth < 1 || input.dayOfMonth > 31)
  ) {
    throw new ValidationError('dayOfMonth must be 1-31');
  }
}

export const recurringTasksService = {
  advance,

  async list() {
    return prisma.recurringTask.findMany({
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
      include: INCLUDE,
    });
  },

  async getById(id: string) {
    const rule = await prisma.recurringTask.findUnique({ where: { id }, include: INCLUDE });
    if (!rule) throw new NotFoundError('Recurring task not found');
    return rule;
  },

  async create(input: CreateRecurringTaskInput, userId?: string) {
    validateRule(input);
    return prisma.recurringTask.create({
      data: {
        name: input.name,
        projectId: input.projectId ?? null,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? 'normal',
        assignedToId: input.assignedToId ?? null,
        frequency: input.frequency,
        interval: input.interval ?? 1,
        dayOfWeek: input.dayOfWeek ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        dueOffsetDays: input.dueOffsetDays ?? 0,
        nextRunAt: input.startAt,
        endAt: input.endAt ?? null,
        createdById: userId ?? null,
      },
      include: INCLUDE,
    });
  },

  async update(id: string, input: UpdateRecurringTaskInput) {
    await this.getById(id);
    const data: Record<string, unknown> = { ...input };
    if (input.startAt) {
      data.nextRunAt = input.startAt;
      delete data.startAt;
    }
    return prisma.recurringTask.update({ where: { id }, data, include: INCLUDE });
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.recurringTask.delete({ where: { id } });
  },

  async runDue(now: Date = new Date()) {
    const due = await prisma.recurringTask.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
    });

    const created: string[] = [];
    for (const rule of due) {
      if (rule.endAt && rule.nextRunAt > rule.endAt) {
        await prisma.recurringTask.update({
          where: { id: rule.id },
          data: { isActive: false },
        });
        continue;
      }

      const task = await prisma.task.create({
        data: {
          title: rule.title,
          description: rule.description,
          priority: rule.priority,
          projectId: rule.projectId,
          assignedToId: rule.assignedToId,
          createdById: rule.createdById,
          dueDate: rule.dueOffsetDays > 0 ? addDays(rule.nextRunAt, rule.dueOffsetDays) : null,
        },
      });
      created.push(task.id);

      await activityService.log({
        entityType: 'task',
        entityId: task.id,
        action: 'created_by_recurring',
        newValue: { recurringTaskId: rule.id, ruleName: rule.name },
        userId: rule.createdById,
      });
      await eventBus.emit({ type: 'task.created', task, actorId: rule.createdById });
      if (task.assignedToId) {
        await eventBus.emit({
          type: 'task.assigned',
          task,
          assigneeId: task.assignedToId,
          actorId: rule.createdById,
        });
      }

      let nextRunAt = advance(rule.nextRunAt, rule);
      // Catch up if the rule had multiple missed runs (e.g. server downtime),
      // but cap to one extra iteration per pass so a wildly out-of-date rule
      // doesn't blast every interval at once.
      if (nextRunAt <= now) {
        nextRunAt = advance(nextRunAt, rule);
      }

      const stillActive = rule.endAt ? nextRunAt <= rule.endAt : true;
      await prisma.recurringTask.update({
        where: { id: rule.id },
        data: {
          lastRunAt: now,
          nextRunAt,
          isActive: stillActive,
        },
      });
    }
    return { generated: created.length, taskIds: created };
  },
};

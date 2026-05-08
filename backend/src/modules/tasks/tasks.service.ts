import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { NotFoundError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';
import { nextOccurrence, parseRecurrence } from './recurrence';

export interface TaskFilters {
  status?: string;
  assignedToId?: string;
  priority?: string;
  projectId?: string;
  parentTaskId?: string | null;
  dueBefore?: Date;
  search?: string;
}

export interface CreateTaskInput {
  projectId?: string | null;
  parentTaskId?: string | null;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assignedToId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  sortOrder?: number;
  recurrence?: string | null;
}

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  completedAt?: Date | null;
};

export interface ReorderInput {
  id: string;
  status: string;
  sortOrder: number;
}

const TASK_INCLUDE = {
  assignedTo: { select: { id: true, displayName: true, email: true } },
  project: { select: { id: true, name: true } },
} as const;

export const tasksService = {
  async list(filters: TaskFilters = {}) {
    const where: Prisma.TaskWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.priority) where.priority = filters.priority;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.parentTaskId !== undefined) where.parentTaskId = filters.parentTaskId;
    if (filters.dueBefore) where.dueDate = { lte: filters.dueBefore };
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }
    return prisma.task.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: TASK_INCLUDE,
    });
  },

  async getById(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        ...TASK_INCLUDE,
        subtasks: { include: TASK_INCLUDE },
      },
    });
    if (!task) throw new NotFoundError('Task not found');
    return task;
  },

  async create(input: CreateTaskInput, userId?: string) {
    const task = await prisma.task.create({
      data: { ...input, createdById: userId ?? null },
      include: TASK_INCLUDE,
    });
    await activityService.log({
      entityType: 'task',
      entityId: task.id,
      action: 'created',
      newValue: { title: task.title, status: task.status, priority: task.priority },
      userId: userId ?? null,
    });
    await eventBus.emit({ type: 'task.created', task, actorId: userId ?? null });
    if (task.assignedToId && task.assignedToId !== userId) {
      await eventBus.emit({
        type: 'task.assigned',
        task,
        assigneeId: task.assignedToId,
        actorId: userId ?? null,
      });
    }
    return task;
  },

  async update(id: string, input: UpdateTaskInput, userId?: string) {
    const before = await this.getById(id);

    if (input.status === 'done' && !before.completedAt && input.completedAt === undefined) {
      input.completedAt = new Date();
    }
    if (input.status && input.status !== 'done' && before.completedAt) {
      input.completedAt = null;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: input,
      include: TASK_INCLUDE,
    });
    await activityService.log({
      entityType: 'task',
      entityId: id,
      action: 'updated',
      oldValue: {
        status: before.status,
        priority: before.priority,
        assignedToId: before.assignedToId,
        title: before.title,
      },
      newValue: {
        status: updated.status,
        priority: updated.priority,
        assignedToId: updated.assignedToId,
        title: updated.title,
      },
      userId: userId ?? null,
    });

    await eventBus.emit({
      type: 'task.updated',
      task: updated,
      before: {
        status: before.status,
        priority: before.priority,
        assignedToId: before.assignedToId,
        title: before.title,
      },
      actorId: userId ?? null,
    });

    if (updated.status !== before.status) {
      await eventBus.emit({
        type: 'task.status_changed',
        task: updated,
        fromStatus: before.status,
        toStatus: updated.status,
        actorId: userId ?? null,
      });
    }

    // Completion-driven recurrence: when a recurring task moves to done,
    // spawn its next occurrence. Skip if the task has already spawned one
    // (in case the user toggles done → in_progress → done).
    if (
      before.status !== 'done' &&
      updated.status === 'done' &&
      updated.recurrence &&
      !updated.parentTaskId
    ) {
      const rule = parseRecurrence(updated.recurrence);
      if (rule) {
        const baseDue = updated.dueDate ?? updated.completedAt ?? new Date();
        const newDueDate = nextOccurrence(rule, baseDue);
        const alreadySpawned = await prisma.task.findFirst({
          where: {
            title: updated.title,
            recurrence: updated.recurrence,
            createdAt: { gte: new Date(Date.now() - 5_000) },
            id: { not: updated.id },
          },
        });
        if (!alreadySpawned) {
          await prisma.task.create({
            data: {
              projectId: updated.projectId,
              parentTaskId: null,
              title: updated.title,
              description: updated.description,
              status: 'to_do',
              priority: updated.priority,
              assignedToId: updated.assignedToId,
              createdById: userId ?? updated.createdById,
              startDate: null,
              dueDate: newDueDate,
              recurrence: updated.recurrence,
            },
          });
          await activityService.log({
            entityType: 'task',
            entityId: id,
            action: 'recurrence_spawned',
            newValue: { dueDate: newDueDate.toISOString() },
            userId: userId ?? null,
          });
        }
      }
    }
    if (
      updated.assignedToId &&
      updated.assignedToId !== before.assignedToId &&
      updated.assignedToId !== userId
    ) {
      await eventBus.emit({
        type: 'task.assigned',
        task: updated,
        assigneeId: updated.assignedToId,
        actorId: userId ?? null,
      });
    }

    return updated;
  },

  async updateStatus(id: string, status: string, userId?: string) {
    return this.update(id, { status }, userId);
  },

  async remove(id: string, userId?: string) {
    await this.getById(id);
    await prisma.task.delete({ where: { id } });
    await activityService.log({
      entityType: 'task',
      entityId: id,
      action: 'deleted',
      userId: userId ?? null,
    });
  },

  async reorder(items: ReorderInput[], userId?: string) {
    await prisma.$transaction(
      items.map((item) =>
        prisma.task.update({
          where: { id: item.id },
          data: { status: item.status, sortOrder: item.sortOrder },
        }),
      ),
    );
    await Promise.all(
      items.map((item) =>
        activityService.log({
          entityType: 'task',
          entityId: item.id,
          action: 'reordered',
          newValue: { status: item.status, sortOrder: item.sortOrder },
          userId: userId ?? null,
        }),
      ),
    );
    return { updated: items.length };
  },

  async listActivity(taskId: string) {
    await this.getById(taskId);
    return activityService.listForEntity('task', taskId);
  },
};

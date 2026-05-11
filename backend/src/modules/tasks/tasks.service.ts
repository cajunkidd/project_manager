import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { NotFoundError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';
import { membersService, type AccessContext } from '../members/members.service';

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

async function ensureTaskAccess(
  taskId: string,
  ctx: AccessContext,
  minRole: 'viewer' | 'editor' = 'viewer',
): Promise<{ projectId: string | null }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) throw new NotFoundError('Task not found');
  if (task.projectId) {
    await membersService.ensureAccess(task.projectId, ctx, minRole);
  }
  return task;
}

export const tasksService = {
  async list(filters: TaskFilters = {}, ctx?: AccessContext) {
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
    if (ctx) {
      const accessible = await membersService.accessibleProjectIds(ctx);
      if (accessible !== 'ALL') {
        // Standalone tasks (projectId = null) stay visible; restrict project tasks.
        const accessFilter: Prisma.TaskWhereInput = {
          OR: [{ projectId: null }, { projectId: { in: accessible } }],
        };
        where.AND = where.AND
          ? Array.isArray(where.AND)
            ? [...where.AND, accessFilter]
            : [where.AND, accessFilter]
          : [accessFilter];
      }
    }
    return prisma.task.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: TASK_INCLUDE,
    });
  },

  async getById(id: string, ctx?: AccessContext) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        ...TASK_INCLUDE,
        subtasks: { include: TASK_INCLUDE },
      },
    });
    if (!task) throw new NotFoundError('Task not found');
    if (ctx && task.projectId) {
      await membersService.ensureAccess(task.projectId, ctx);
    }
    return task;
  },

  async create(input: CreateTaskInput, userId?: string, ctx?: AccessContext) {
    if (ctx && input.projectId) {
      await membersService.ensureAccess(input.projectId, ctx, 'editor');
    }
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

  async update(id: string, input: UpdateTaskInput, userId?: string, ctx?: AccessContext) {
    const before = await this.getById(id);
    if (ctx && before.projectId) {
      await membersService.ensureAccess(before.projectId, ctx, 'editor');
    }
    if (ctx && input.projectId && input.projectId !== before.projectId) {
      await membersService.ensureAccess(input.projectId, ctx, 'editor');
    }

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

  async updateStatus(id: string, status: string, userId?: string, ctx?: AccessContext) {
    return this.update(id, { status }, userId, ctx);
  },

  async remove(id: string, userId?: string, ctx?: AccessContext) {
    const existing = await this.getById(id);
    if (ctx && existing.projectId) {
      await membersService.ensureAccess(existing.projectId, ctx, 'editor');
    }
    await prisma.task.delete({ where: { id } });
    await activityService.log({
      entityType: 'task',
      entityId: id,
      action: 'deleted',
      userId: userId ?? null,
    });
  },

  async reorder(items: ReorderInput[], userId?: string, ctx?: AccessContext) {
    if (ctx) {
      for (const item of items) {
        await ensureTaskAccess(item.id, ctx, 'editor');
      }
    }
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

  async listActivity(taskId: string, ctx?: AccessContext) {
    await this.getById(taskId, ctx);
    return activityService.listForEntity('task', taskId);
  },
};

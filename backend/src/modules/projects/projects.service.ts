import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { NotFoundError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

export interface ProjectFilters {
  status?: string;
  ownerId?: string;
  department?: string;
  priority?: string;
  search?: string;
  isTemplate?: boolean;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  ownerId?: string | null;
  status?: string;
  priority?: string;
  department?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  isTemplate?: boolean;
}

export interface CloneProjectInput {
  name?: string;
  ownerId?: string | null;
  department?: string | null;
  isTemplate?: boolean;
}

export type UpdateProjectInput = Partial<CreateProjectInput> & {
  completedAt?: Date | null;
};

export const projectsService = {
  async list(filters: ProjectFilters = {}) {
    const where: Prisma.ProjectWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.department) where.department = filters.department;
    if (filters.priority) where.priority = filters.priority;
    where.isTemplate = filters.isTemplate ?? false;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }
    return prisma.project.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        _count: { select: { tasks: true } },
      },
    });
  },

  async getById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!project) throw new NotFoundError('Project not found');
    return project;
  },

  async create(input: CreateProjectInput, userId?: string) {
    const project = await prisma.project.create({
      data: { ...input, createdById: userId ?? null },
    });
    await activityService.log({
      entityType: 'project',
      entityId: project.id,
      action: 'created',
      newValue: { name: project.name, status: project.status },
      userId: userId ?? null,
    });
    await eventBus.emit({ type: 'project.created', project, actorId: userId ?? null });
    return project;
  },

  async update(id: string, input: UpdateProjectInput, userId?: string) {
    const before = await this.getById(id);

    if (input.status === 'completed' && !before.completedAt && input.completedAt === undefined) {
      input.completedAt = new Date();
    }
    if (input.status && input.status !== 'completed' && before.completedAt) {
      input.completedAt = null;
    }

    const updated = await prisma.project.update({ where: { id }, data: input });
    await activityService.log({
      entityType: 'project',
      entityId: id,
      action: 'updated',
      oldValue: { status: before.status, name: before.name, priority: before.priority },
      newValue: { status: updated.status, name: updated.name, priority: updated.priority },
      userId: userId ?? null,
    });
    await eventBus.emit({ type: 'project.updated', project: updated, actorId: userId ?? null });
    return updated;
  },

  async remove(id: string, userId?: string) {
    await this.getById(id);
    await prisma.project.delete({ where: { id } });
    await activityService.log({
      entityType: 'project',
      entityId: id,
      action: 'deleted',
      userId: userId ?? null,
    });
  },

  async clone(sourceId: string, input: CloneProjectInput, userId?: string) {
    const source = await this.getById(sourceId);
    const sourceTasks = await prisma.task.findMany({
      where: { projectId: sourceId },
      orderBy: [{ parentTaskId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const project = await prisma.project.create({
      data: {
        name: input.name ?? `${source.name} (copy)`,
        description: source.description,
        ownerId: input.ownerId !== undefined ? input.ownerId : source.ownerId,
        department:
          input.department !== undefined ? input.department : source.department,
        priority: source.priority,
        status: 'not_started',
        isTemplate: input.isTemplate ?? false,
        createdById: userId ?? null,
      },
    });

    // Clone tasks in dependency order (parents before children) so we can remap parentTaskId.
    const idMap = new Map<string, string>();
    const remaining = [...sourceTasks];
    let safety = remaining.length * 2 + 1;
    while (remaining.length > 0 && safety-- > 0) {
      const t = remaining.shift()!;
      if (t.parentTaskId && !idMap.has(t.parentTaskId)) {
        // Parent not yet cloned — push to the back.
        remaining.push(t);
        continue;
      }
      const created = await prisma.task.create({
        data: {
          projectId: project.id,
          parentTaskId: t.parentTaskId ? idMap.get(t.parentTaskId)! : null,
          title: t.title,
          description: t.description,
          status: 'to_do',
          priority: t.priority,
          assignedToId: t.assignedToId,
          createdById: userId ?? null,
          sortOrder: t.sortOrder,
          recurrence: t.recurrence,
          recurrenceEndsAt: t.recurrenceEndsAt,
        },
      });
      idMap.set(t.id, created.id);
    }

    await activityService.log({
      entityType: 'project',
      entityId: project.id,
      action: 'cloned',
      newValue: { sourceProjectId: sourceId, taskCount: idMap.size },
      userId: userId ?? null,
    });
    await eventBus.emit({ type: 'project.created', project, actorId: userId ?? null });
    return project;
  },

  async listTasks(projectId: string) {
    await this.getById(projectId);
    return prisma.task.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        assignedTo: { select: { id: true, displayName: true, email: true } },
      },
    });
  },

  async listActivity(projectId: string) {
    await this.getById(projectId);
    return activityService.listForEntity('project', projectId);
  },
};

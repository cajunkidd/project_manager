import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { NotFoundError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';
import { membersService, type AccessContext } from '../members/members.service';

export interface ProjectFilters {
  status?: string;
  ownerId?: string;
  department?: string;
  priority?: string;
  search?: string;
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
  portfolioId?: string | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
}

export type UpdateProjectInput = Partial<CreateProjectInput> & {
  completedAt?: Date | null;
};

function buildAccessWhere(
  ids: string[] | 'ALL',
): Prisma.ProjectWhereInput | undefined {
  if (ids === 'ALL') return undefined;
  return { id: { in: ids } };
}

export const projectsService = {
  async list(filters: ProjectFilters = {}, ctx?: AccessContext) {
    const where: Prisma.ProjectWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.department) where.department = filters.department;
    if (filters.priority) where.priority = filters.priority;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }
    if (ctx) {
      const accessible = await membersService.accessibleProjectIds(ctx);
      const access = buildAccessWhere(accessible);
      if (access) Object.assign(where, access);
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

  async getById(id: string, ctx?: AccessContext) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!project) throw new NotFoundError('Project not found');
    if (ctx) await membersService.ensureAccess(id, ctx);
    return project;
  },

  async create(input: CreateProjectInput, userId?: string) {
    const project = await prisma.project.create({
      data: { ...input, createdById: userId ?? null },
    });
    if (userId) {
      await membersService.ensureOwnerSeeded(project.id, userId);
    }
    if (input.ownerId && input.ownerId !== userId) {
      await membersService.ensureOwnerSeeded(project.id, input.ownerId);
    }
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

  async update(id: string, input: UpdateProjectInput, userId?: string, ctx?: AccessContext) {
    if (ctx) await membersService.ensureAccess(id, ctx, 'editor');
    const before = await this.getById(id);

    if (input.status === 'completed' && !before.completedAt && input.completedAt === undefined) {
      input.completedAt = new Date();
    }
    if (input.status && input.status !== 'completed' && before.completedAt) {
      input.completedAt = null;
    }

    const updated = await prisma.project.update({ where: { id }, data: input });
    if (input.ownerId && input.ownerId !== before.ownerId) {
      await membersService.ensureOwnerSeeded(id, input.ownerId);
    }
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

  async remove(id: string, userId?: string, ctx?: AccessContext) {
    if (ctx) await membersService.ensureAccess(id, ctx, 'owner');
    await this.getById(id);
    await prisma.project.delete({ where: { id } });
    await activityService.log({
      entityType: 'project',
      entityId: id,
      action: 'deleted',
      userId: userId ?? null,
    });
  },

  async listTasks(projectId: string, ctx?: AccessContext) {
    if (ctx) await membersService.ensureAccess(projectId, ctx);
    await this.getById(projectId);
    return prisma.task.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        assignedTo: { select: { id: true, displayName: true, email: true } },
      },
    });
  },

  async listActivity(projectId: string, ctx?: AccessContext) {
    if (ctx) await membersService.ensureAccess(projectId, ctx);
    await this.getById(projectId);
    return activityService.listForEntity('project', projectId);
  },
};

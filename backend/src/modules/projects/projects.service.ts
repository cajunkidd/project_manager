import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

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

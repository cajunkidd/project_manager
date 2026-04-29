import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

const PROJECT_SELECT = {
  id: true, name: true, description: true, status: true, priority: true,
  department: true, startDate: true, dueDate: true, completedAt: true,
  createdAt: true, updatedAt: true,
  owner: { select: { id: true, displayName: true, email: true } },
  createdBy: { select: { id: true, displayName: true } },
  _count: { select: { tasks: true } },
};

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll(filters: { status?: string; ownerId?: string; department?: string; priority?: string; search?: string }) {
    return this.prisma.project.findMany({
      where: {
        ...(filters.status && { status: filters.status }),
        ...(filters.ownerId && { ownerId: filters.ownerId }),
        ...(filters.department && { department: filters.department }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.search && { name: { contains: filters.search, mode: 'insensitive' } }),
      },
      select: PROJECT_SELECT,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        ...PROJECT_SELECT,
        tasks: {
          select: {
            id: true, title: true, status: true, priority: true, dueDate: true, sortOrder: true,
            assignee: { select: { id: true, displayName: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        comments: {
          select: {
            id: true, body: true, createdAt: true, updatedAt: true,
            user: { select: { id: true, displayName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(data: any, userId: string) {
    const project = await this.prisma.project.create({
      data: { ...data, createdById: userId },
      select: PROJECT_SELECT,
    });
    await this.activityLogs.log('project', project.id, 'created', null, { name: project.name }, userId);
    return project;
  }

  async update(id: string, data: any, userId: string) {
    const old = await this.findById(id);
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === 'completed' && !old.completedAt ? { completedAt: new Date() } : {}),
      },
      select: PROJECT_SELECT,
    });
    await this.activityLogs.log('project', id, 'updated', old, data, userId);
    return updated;
  }

  async remove(id: string, userId: string) {
    await this.findById(id);
    await this.activityLogs.log('project', id, 'deleted', null, null, userId);
    return this.prisma.project.delete({ where: { id } });
  }

  async getActivity(id: string) {
    await this.findById(id);
    return this.prisma.activityLog.findMany({
      where: { entityId: id, entityType: 'project' },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}

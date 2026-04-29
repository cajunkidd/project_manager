import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationEngine } from '../automations/automation-engine.service';

const TASK_SELECT = {
  id: true, title: true, description: true, status: true, priority: true,
  startDate: true, dueDate: true, completedAt: true, sortOrder: true,
  createdAt: true, updatedAt: true,
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, displayName: true, email: true } },
  createdBy: { select: { id: true, displayName: true } },
  parentTask: { select: { id: true, title: true } },
  _count: { select: { subtasks: true, comments: true } },
};

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private notifications: NotificationsService,
    private automationEngine: AutomationEngine,
  ) {}

  async findAll(filters: {
    projectId?: string; status?: string; assignedTo?: string;
    priority?: string; search?: string; overdue?: string; parentTaskId?: string;
  }) {
    const now = new Date();
    return this.prisma.task.findMany({
      where: {
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.assignedTo && { assignedTo: filters.assignedTo }),
        ...(filters.priority && { priority: filters.priority }),
        ...(filters.search && { title: { contains: filters.search, mode: 'insensitive' } }),
        ...(filters.overdue === 'true' && { dueDate: { lt: now }, status: { notIn: ['done', 'cancelled'] } }),
        ...(filters.parentTaskId !== undefined
          ? { parentTaskId: filters.parentTaskId || null }
          : {}),
      },
      select: TASK_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: {
        ...TASK_SELECT,
        subtasks: { select: TASK_SELECT, orderBy: { sortOrder: 'asc' } },
        comments: {
          select: {
            id: true, body: true, createdAt: true, updatedAt: true,
            user: { select: { id: true, displayName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    const activityLogs = await this.prisma.activityLog.findMany({
      where: { entityType: 'task', entityId: id },
      select: {
        id: true, action: true, oldValue: true, newValue: true, createdAt: true,
        user: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { ...task, activityLogs };
  }

  async create(data: any, userId: string) {
    const task = await this.prisma.task.create({
      data: { ...data, createdById: userId },
      select: TASK_SELECT,
    });
    await this.activityLogs.log('task', task.id, 'created', null, { title: task.title }, userId);
    if (task.assignee && task.assignee.id !== userId) {
      await this.notifications.create({
        userId: task.assignee.id,
        title: 'Task Assigned',
        message: `You have been assigned to: ${task.title}`,
        type: 'task_assigned',
        entityType: 'task',
        entityId: task.id,
      });
    }
    await this.automationEngine.trigger('task.created', { task, triggeredBy: userId });
    if (task.assignee) {
      await this.automationEngine.trigger('task.assigned', { task, triggeredBy: userId });
    }
    return task;
  }

  async update(id: string, data: any, userId: string) {
    const old = await this.findById(id);
    const updateData: any = { ...data };
    if (data.status === 'done' && old.status !== 'done') updateData.completedAt = new Date();
    if (data.status && data.status !== 'done') updateData.completedAt = null;

    const updated = await this.prisma.task.update({
      where: { id },
      data: updateData,
      select: TASK_SELECT,
    });

    if (data.status && data.status !== old.status) {
      await this.activityLogs.log('task', id, 'status_changed', { status: old.status }, { status: data.status }, userId);
    } else {
      await this.activityLogs.log('task', id, 'updated', old, data, userId);
    }

    if (data.assignedTo && data.assignedTo !== old.assignee?.id) {
      await this.notifications.create({
        userId: data.assignedTo,
        title: 'Task Assigned',
        message: `You have been assigned to: ${updated.title}`,
        type: 'task_assigned',
        entityType: 'task',
        entityId: id,
      });
    }

    if (data.status && data.status !== old.status) {
      await this.automationEngine.trigger('task.status_changed', {
        task: updated, oldTask: old, triggeredBy: userId,
      });
    }
    if (data.assignedTo && data.assignedTo !== old.assignee?.id) {
      await this.automationEngine.trigger('task.assigned', {
        task: updated, oldTask: old, triggeredBy: userId,
      });
    }
    if (data.priority && data.priority !== old.priority) {
      await this.automationEngine.trigger('task.priority_changed', {
        task: updated, oldTask: old, triggeredBy: userId,
      });
    }

    return updated;
  }

  async updateStatus(id: string, status: string, userId: string) {
    return this.update(id, { status }, userId);
  }

  async reorder(tasks: { id: string; sortOrder: number }[]) {
    await Promise.all(
      tasks.map(({ id, sortOrder }) =>
        this.prisma.task.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    return { success: true };
  }

  async remove(id: string, userId: string) {
    await this.findById(id);
    await this.activityLogs.log('task', id, 'deleted', null, null, userId);
    return this.prisma.task.delete({ where: { id } });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async tasksByUser(filters: { department?: string; projectId?: string }) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(filters.department && { department: filters.department }),
      },
      select: {
        id: true,
        displayName: true,
        department: true,
        assignedTasks: {
          where: {
            status: { notIn: ['done', 'cancelled'] },
            ...(filters.projectId && { projectId: filters.projectId }),
          },
          select: { id: true, status: true, priority: true, dueDate: true },
        },
      },
      orderBy: { displayName: 'asc' },
    });

    const now = new Date();
    return users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      department: u.department,
      open: u.assignedTasks.length,
      overdue: u.assignedTasks.filter((t) => t.dueDate && t.dueDate < now).length,
      urgent: u.assignedTasks.filter((t) => t.priority === 'urgent').length,
      high: u.assignedTasks.filter((t) => t.priority === 'high').length,
    }));
  }

  async overdueTasks(filters: { department?: string; projectId?: string; userId?: string }) {
    const now = new Date();
    return this.prisma.task.findMany({
      where: {
        status: { notIn: ['done', 'cancelled'] },
        dueDate: { lt: now },
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.userId && { assignedTo: filters.userId }),
        ...(filters.department && { assignee: { department: filters.department } }),
      },
      select: {
        id: true, title: true, status: true, priority: true, dueDate: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, displayName: true, department: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async projectsByStatus(filters: { department?: string }) {
    const projects = await this.prisma.project.findMany({
      where: { ...(filters.department && { department: filters.department }) },
      select: {
        id: true, name: true, status: true, priority: true, dueDate: true,
        owner: { select: { id: true, displayName: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });

    const grouped = projects.reduce<Record<string, any[]>>((acc, p) => {
      if (!acc[p.status]) acc[p.status] = [];
      acc[p.status].push(p);
      return acc;
    }, {});

    const summary = Object.entries(grouped).map(([status, items]) => ({
      status,
      count: items.length,
      projects: items,
    }));

    return { summary, projects };
  }

  async completionTrend(weeks = 8) {
    const results: { week: string; completed: number }[] = [];
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i * 7 - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const count = await this.prisma.task.count({
        where: { status: 'done', completedAt: { gte: start, lte: end } },
      });

      results.push({
        week: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: count,
      });
    }

    return results;
  }

  async blockedTasks(filters: { projectId?: string; userId?: string }) {
    return this.prisma.task.findMany({
      where: {
        status: 'waiting',
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.userId && { assignedTo: filters.userId }),
      },
      select: {
        id: true, title: true, priority: true, dueDate: true, createdAt: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, displayName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async avgCompletionTime(filters: { projectId?: string; userId?: string }) {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: 'done',
        completedAt: { not: null },
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.userId && { assignedTo: filters.userId }),
      },
      select: { createdAt: true, completedAt: true, priority: true },
    });

    if (tasks.length === 0) return { avgDays: 0, byPriority: [] };

    const totalMs = tasks.reduce((sum, t) => {
      return sum + (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime());
    }, 0);

    const avgDays = Math.round((totalMs / tasks.length) / (1000 * 60 * 60 * 24));

    const byPriority = ['low', 'normal', 'high', 'urgent'].map((priority) => {
      const group = tasks.filter((t) => t.priority === priority);
      if (group.length === 0) return { priority, avgDays: 0, count: 0 };
      const ms = group.reduce((sum, t) => {
        return sum + (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime());
      }, 0);
      return { priority, avgDays: Math.round((ms / group.length) / (1000 * 60 * 60 * 24)), count: group.length };
    });

    return { avgDays, byPriority, total: tasks.length };
  }

  async workload(filters: { department?: string }) {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const users = await this.prisma.user.findMany({
      where: { isActive: true, ...(filters.department && { department: filters.department }) },
      select: {
        id: true, displayName: true, department: true,
        assignedTasks: {
          select: { id: true, status: true, priority: true, dueDate: true, completedAt: true },
        },
      },
      orderBy: { displayName: 'asc' },
    });

    return users.map((u) => {
      const open = u.assignedTasks.filter((t) => !['done', 'cancelled'].includes(t.status));
      const completedThisWeek = u.assignedTasks.filter(
        (t) => t.completedAt && t.completedAt >= weekStart && t.completedAt <= now,
      );
      return {
        id: u.id,
        displayName: u.displayName,
        department: u.department,
        openTasks: open.length,
        overdueTasks: open.filter((t) => t.dueDate && t.dueDate < now).length,
        urgentTasks: open.filter((t) => t.priority === 'urgent').length,
        dueThisWeek: open.filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= weekEnd).length,
        completedThisWeek: completedThisWeek.length,
      };
    });
  }
}

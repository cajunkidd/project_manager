import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getUserDashboard(userId: string) {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [openTasks, overdueTasks, dueSoonTasks, recentActivity] = await Promise.all([
      this.prisma.task.findMany({
        where: { assignedTo: userId, status: { notIn: ['done', 'cancelled'] } },
        select: {
          id: true, title: true, status: true, priority: true, dueDate: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      this.prisma.task.findMany({
        where: { assignedTo: userId, status: { notIn: ['done', 'cancelled'] }, dueDate: { lt: now } },
        select: {
          id: true, title: true, status: true, priority: true, dueDate: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.task.findMany({
        where: {
          assignedTo: userId, status: { notIn: ['done', 'cancelled'] },
          dueDate: { gte: now, lte: weekEnd },
        },
        select: {
          id: true, title: true, status: true, priority: true, dueDate: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.activityLog.findMany({
        where: { userId },
        include: { user: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return { openTasks, overdueTasks, dueSoonTasks, recentActivity };
  }

  async getManagerDashboard() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const [tasksByUser, projectsByStatus, completedThisWeek, blockedTasks] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true, displayName: true, department: true,
          assignedTasks: {
            where: { status: { notIn: ['done', 'cancelled'] } },
            select: { id: true, status: true, priority: true, dueDate: true },
          },
        },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.task.count({
        where: { status: 'done', completedAt: { gte: weekStart } },
      }),
      this.prisma.task.findMany({
        where: { status: 'waiting' },
        select: {
          id: true, title: true, priority: true, dueDate: true,
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, displayName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
    ]);

    const tasksByUserFormatted = tasksByUser.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      department: u.department,
      openCount: u.assignedTasks.length,
      overdueCount: u.assignedTasks.filter((t) => t.dueDate && t.dueDate < now).length,
      urgentCount: u.assignedTasks.filter((t) => t.priority === 'urgent').length,
    }));

    return { tasksByUser: tasksByUserFormatted, projectsByStatus, completedThisWeek, blockedTasks };
  }
}

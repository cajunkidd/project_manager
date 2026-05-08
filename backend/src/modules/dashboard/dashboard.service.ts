import { prisma } from '../../db/prisma';

const TASK_OPEN_STATUSES = ['backlog', 'to_do', 'in_progress', 'waiting', 'review'];

function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeek(date = new Date()): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

export const dashboardService = {
  async forUser(userId: string) {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const [open, overdue, dueThisWeek, recent] = await Promise.all([
      prisma.task.findMany({
        where: { assignedToId: userId, status: { in: TASK_OPEN_STATUSES } },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        take: 50,
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          status: { in: TASK_OPEN_STATUSES },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: 'asc' },
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          status: { in: TASK_OPEN_STATUSES },
          dueDate: { gte: weekStart, lt: weekEnd },
        },
        orderBy: { dueDate: 'asc' },
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.task.findMany({
        where: { assignedToId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: { project: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      counts: {
        open: open.length,
        overdue: overdue.length,
        dueThisWeek: dueThisWeek.length,
      },
      open,
      overdue,
      dueThisWeek,
      recentlyUpdated: recent,
    };
  },

  async forManager() {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const [openByUser, overdueByUser, projectsByStatus, completedThisWeek, blocked] =
      await Promise.all([
        prisma.task.groupBy({
          by: ['assignedToId'],
          where: { status: { in: TASK_OPEN_STATUSES }, assignedToId: { not: null } },
          _count: { _all: true },
        }),
        prisma.task.groupBy({
          by: ['assignedToId'],
          where: {
            status: { in: TASK_OPEN_STATUSES },
            dueDate: { lt: now },
            assignedToId: { not: null },
          },
          _count: { _all: true },
        }),
        prisma.project.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        prisma.task.count({
          where: { status: 'done', completedAt: { gte: weekStart, lt: weekEnd } },
        }),
        prisma.task.findMany({
          where: { status: 'waiting' },
          include: {
            project: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, displayName: true } },
          },
          take: 50,
        }),
      ]);

    return {
      openByUser: openByUser.map((row) => ({
        userId: row.assignedToId,
        count: row._count._all,
      })),
      overdueByUser: overdueByUser.map((row) => ({
        userId: row.assignedToId,
        count: row._count._all,
      })),
      projectsByStatus: projectsByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      completedThisWeek,
      blocked,
    };
  },
};

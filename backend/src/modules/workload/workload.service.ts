import { prisma } from '../../db/prisma';
import { TASK_OPEN_STATUSES } from '../reports/reports.service';

export interface WorkloadFilters {
  department?: string;
  projectId?: string;
}

interface UserWorkload {
  user: { id: string; displayName: string; email: string; department: string | null };
  open: number;
  overdue: number;
  urgent: number;
  dueThisWeek: number;
  completedThisWeek: number;
}

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

export const workloadService = {
  async list(filters: WorkloadFilters = {}): Promise<UserWorkload[]> {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(filters.department ? { department: filters.department } : {}),
      },
      select: { id: true, displayName: true, email: true, department: true },
      orderBy: { displayName: 'asc' },
    });
    if (!users.length) return [];
    const ids = users.map((u) => u.id);

    const projectFilter = filters.projectId ? { projectId: filters.projectId } : {};

    const [open, overdue, urgent, dueThisWeek, completedThisWeek] = await Promise.all([
      prisma.task.groupBy({
        by: ['assignedToId'],
        where: {
          assignedToId: { in: ids },
          status: { in: TASK_OPEN_STATUSES },
          ...projectFilter,
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ['assignedToId'],
        where: {
          assignedToId: { in: ids },
          status: { in: TASK_OPEN_STATUSES },
          dueDate: { lt: now },
          ...projectFilter,
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ['assignedToId'],
        where: {
          assignedToId: { in: ids },
          status: { in: TASK_OPEN_STATUSES },
          priority: 'urgent',
          ...projectFilter,
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ['assignedToId'],
        where: {
          assignedToId: { in: ids },
          status: { in: TASK_OPEN_STATUSES },
          dueDate: { gte: weekStart, lt: weekEnd },
          ...projectFilter,
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ['assignedToId'],
        where: {
          assignedToId: { in: ids },
          status: 'done',
          completedAt: { gte: weekStart, lt: weekEnd },
          ...projectFilter,
        },
        _count: { _all: true },
      }),
    ]);

    function toMap(rows: { assignedToId: string | null; _count: { _all: number } }[]) {
      return new Map(rows.map((r) => [r.assignedToId, r._count._all]));
    }
    const openMap = toMap(open);
    const overdueMap = toMap(overdue);
    const urgentMap = toMap(urgent);
    const dueMap = toMap(dueThisWeek);
    const doneMap = toMap(completedThisWeek);

    return users.map((u) => ({
      user: u,
      open: openMap.get(u.id) ?? 0,
      overdue: overdueMap.get(u.id) ?? 0,
      urgent: urgentMap.get(u.id) ?? 0,
      dueThisWeek: dueMap.get(u.id) ?? 0,
      completedThisWeek: doneMap.get(u.id) ?? 0,
    }));
  },
};

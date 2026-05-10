import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

const TASK_OPEN_STATUSES = ['backlog', 'to_do', 'in_progress', 'waiting', 'review'];
const TASK_BLOCKED_STATUSES = ['waiting'];

export interface ReportFilters {
  from?: Date;
  to?: Date;
  department?: string;
  projectId?: string;
  userId?: string;
  priority?: string;
}

interface UserSummary {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
}

function userMatchesFilters(filters: ReportFilters): Prisma.UserWhereInput | undefined {
  if (filters.department) return { department: filters.department };
  return undefined;
}

function taskBaseWhere(filters: ReportFilters): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.userId) where.assignedToId = filters.userId;
  if (filters.priority) where.priority = filters.priority;
  if (filters.department) {
    where.assignedTo = { department: filters.department };
  }
  return where;
}

function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function isoWeekKey(date: Date): string {
  const d = startOfWeek(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadUserSummaries(filters: ReportFilters): Promise<UserSummary[]> {
  return prisma.user.findMany({
    where: { isActive: true, ...(userMatchesFilters(filters) ?? {}) },
    select: { id: true, displayName: true, email: true, department: true },
    orderBy: { displayName: 'asc' },
  });
}

export const reportsService = {
  async openTasksByUser(filters: ReportFilters = {}) {
    const where: Prisma.TaskWhereInput = {
      ...taskBaseWhere(filters),
      status: { in: TASK_OPEN_STATUSES },
      assignedToId: { not: null },
    };
    const groups = await prisma.task.groupBy({
      by: ['assignedToId'],
      where,
      _count: { _all: true },
    });
    const users = await loadUserSummaries(filters);
    const counts = new Map(groups.map((g) => [g.assignedToId, g._count._all]));
    return users.map((u) => ({
      user: u,
      count: counts.get(u.id) ?? 0,
    }));
  },

  async overdueTasks(filters: ReportFilters = {}) {
    const now = new Date();
    return prisma.task.findMany({
      where: {
        ...taskBaseWhere(filters),
        status: { in: TASK_OPEN_STATUSES },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, displayName: true, email: true } },
      },
      take: 200,
    });
  },

  async projectsByStatus(filters: ReportFilters = {}) {
    const where: Prisma.ProjectWhereInput = {};
    if (filters.department) where.department = filters.department;
    if (filters.userId) where.ownerId = filters.userId;
    const groups = await prisma.project.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    return groups.map((g) => ({ status: g.status, count: g._count._all }));
  },

  async tasksCompletedByWeek(filters: ReportFilters = {}) {
    const from = filters.from ?? new Date(Date.now() - 12 * 7 * 24 * 3600 * 1000);
    const tasks = await prisma.task.findMany({
      where: {
        ...taskBaseWhere(filters),
        status: 'done',
        completedAt: { gte: from, ...(filters.to ? { lte: filters.to } : {}) },
      },
      select: { completedAt: true },
    });
    const buckets = new Map<string, number>();
    for (const t of tasks) {
      if (!t.completedAt) continue;
      const key = isoWeekKey(t.completedAt);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([weekStart, count]) => ({ weekStart, count }));
  },

  async averageCompletionTime(filters: ReportFilters = {}) {
    const tasks = await prisma.task.findMany({
      where: {
        ...taskBaseWhere(filters),
        status: 'done',
        completedAt: { not: null },
      },
      select: { createdAt: true, completedAt: true },
    });
    if (!tasks.length) return { sampleSize: 0, avgHours: 0, avgDays: 0 };
    const totalMs = tasks.reduce(
      (sum, t) => sum + (t.completedAt!.getTime() - t.createdAt.getTime()),
      0,
    );
    const avgMs = totalMs / tasks.length;
    return {
      sampleSize: tasks.length,
      avgHours: Math.round((avgMs / 3_600_000) * 10) / 10,
      avgDays: Math.round((avgMs / 86_400_000) * 10) / 10,
    };
  },

  async blockedTasks(filters: ReportFilters = {}) {
    return prisma.task.findMany({
      where: {
        ...taskBaseWhere(filters),
        status: { in: TASK_BLOCKED_STATUSES },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, displayName: true, email: true } },
      },
      take: 200,
    });
  },

  async tasksBlockedByDependencies(filters: ReportFilters = {}) {
    const deps = await prisma.taskDependency.findMany({
      where: {
        task: {
          ...taskBaseWhere(filters),
          status: { in: TASK_OPEN_STATUSES },
        },
        dependsOnTask: { status: { in: TASK_OPEN_STATUSES } },
      },
      include: {
        dependsOnTask: { select: { id: true, title: true, status: true } },
        task: {
          include: {
            project: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });
    const byTask = new Map<
      string,
      {
        task: (typeof deps)[number]['task'];
        blockers: { id: string; title: string; status: string }[];
      }
    >();
    for (const d of deps) {
      const bucket = byTask.get(d.taskId) ?? { task: d.task, blockers: [] };
      bucket.blockers.push(d.dependsOnTask);
      byTask.set(d.taskId, bucket);
    }
    return Array.from(byTask.values());
  },
};

export { TASK_OPEN_STATUSES, TASK_BLOCKED_STATUSES };

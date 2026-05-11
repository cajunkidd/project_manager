import { prisma } from '../../db/prisma';
import { TASK_OPEN_STATUSES } from './ai.constants';

const DAY_MS = 86_400_000;

export interface ExecSummary {
  period: { start: string; end: string; days: number };
  headline: string;
  metrics: {
    activeProjects: number;
    completedProjects: number;
    tasksCompleted: number;
    tasksCreated: number;
    tasksOverdue: number;
    tasksBlocked: number;
    commentsPosted: number;
  };
  completedHighlights: { id: string; name: string; completedAt: string }[];
  newProjects: { id: string; name: string; createdAt: string }[];
  topRisks: {
    projectId: string;
    name: string;
    overdueTasks: number;
    blockedTasks: number;
    daysSinceUpdate: number;
  }[];
  stalledProjects: { id: string; name: string; daysSinceUpdate: number }[];
  byDepartment: { department: string; active: number; completed: number; overdue: number }[];
  recommendations: string[];
}

export interface ExecSummaryOptions {
  since?: Date;
  now?: Date;
}

export async function buildExecSummary(opts: ExecSummaryOptions = {}): Promise<ExecSummary> {
  const now = opts.now ?? new Date();
  const since = opts.since ?? new Date(now.getTime() - 7 * DAY_MS);
  const days = Math.max(1, Math.round((now.getTime() - since.getTime()) / DAY_MS));

  const openStatuses = [...TASK_OPEN_STATUSES];

  const [
    projects,
    completedProjects,
    newProjects,
    tasksCompleted,
    tasksCreated,
    overdueTasks,
    blockedTasks,
    commentsPosted,
    recentActivity,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { status: { in: ['active', 'not_started', 'on_hold'] } },
      select: {
        id: true,
        name: true,
        department: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.project.findMany({
      where: { completedAt: { gte: since, lte: now } },
      select: { id: true, name: true, completedAt: true, department: true },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.project.findMany({
      where: { createdAt: { gte: since, lte: now } },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.task.findMany({
      where: { completedAt: { gte: since, lte: now }, status: 'done' },
      select: { id: true, projectId: true, title: true },
    }),
    prisma.task.count({ where: { createdAt: { gte: since, lte: now } } }),
    prisma.task.findMany({
      where: { status: { in: openStatuses }, dueDate: { lt: now } },
      select: { id: true, projectId: true },
    }),
    prisma.task.findMany({
      where: { status: 'waiting' },
      select: { id: true, projectId: true },
    }),
    prisma.comment.count({ where: { createdAt: { gte: since, lte: now } } }),
    prisma.task.findMany({
      where: { updatedAt: { gte: since, lte: now } },
      select: { projectId: true, updatedAt: true },
    }),
  ]);

  const overdueByProject = new Map<string, number>();
  for (const t of overdueTasks) {
    if (!t.projectId) continue;
    overdueByProject.set(t.projectId, (overdueByProject.get(t.projectId) ?? 0) + 1);
  }
  const blockedByProject = new Map<string, number>();
  for (const t of blockedTasks) {
    if (!t.projectId) continue;
    blockedByProject.set(t.projectId, (blockedByProject.get(t.projectId) ?? 0) + 1);
  }
  const completedByProject = new Map<string, number>();
  for (const t of tasksCompleted) {
    if (!t.projectId) continue;
    completedByProject.set(t.projectId, (completedByProject.get(t.projectId) ?? 0) + 1);
  }
  const lastActivityByProject = new Map<string, Date>();
  for (const a of recentActivity) {
    if (!a.projectId) continue;
    const prev = lastActivityByProject.get(a.projectId);
    if (!prev || a.updatedAt > prev) lastActivityByProject.set(a.projectId, a.updatedAt);
  }

  const topRisks = projects
    .map((p) => {
      const lastActivity = lastActivityByProject.get(p.id) ?? p.updatedAt;
      const daysSinceUpdate = Math.floor((now.getTime() - lastActivity.getTime()) / DAY_MS);
      return {
        projectId: p.id,
        name: p.name,
        overdueTasks: overdueByProject.get(p.id) ?? 0,
        blockedTasks: blockedByProject.get(p.id) ?? 0,
        daysSinceUpdate,
      };
    })
    .filter((r) => r.overdueTasks > 0 || r.blockedTasks > 0 || r.daysSinceUpdate >= 14)
    .sort(
      (a, b) =>
        b.overdueTasks * 3 + b.blockedTasks * 2 + b.daysSinceUpdate / 7 -
        (a.overdueTasks * 3 + a.blockedTasks * 2 + a.daysSinceUpdate / 7),
    )
    .slice(0, 5);

  const stalledProjects = projects
    .map((p) => {
      const lastActivity = lastActivityByProject.get(p.id) ?? p.updatedAt;
      const daysSinceUpdate = Math.floor((now.getTime() - lastActivity.getTime()) / DAY_MS);
      return { id: p.id, name: p.name, daysSinceUpdate };
    })
    .filter((p) => p.daysSinceUpdate >= 14)
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 5);

  const deptMap = new Map<
    string,
    { department: string; active: number; completed: number; overdue: number }
  >();
  for (const p of projects) {
    const key = p.department ?? 'Unassigned';
    const entry = deptMap.get(key) ?? { department: key, active: 0, completed: 0, overdue: 0 };
    if (p.status === 'active') entry.active += 1;
    entry.overdue += overdueByProject.get(p.id) ?? 0;
    deptMap.set(key, entry);
  }
  for (const p of completedProjects) {
    const key = p.department ?? 'Unassigned';
    const entry = deptMap.get(key) ?? { department: key, active: 0, completed: 0, overdue: 0 };
    entry.completed += 1;
    deptMap.set(key, entry);
  }
  const byDepartment = [...deptMap.values()].sort((a, b) => b.active - a.active);

  const metrics = {
    activeProjects: projects.filter((p) => p.status === 'active').length,
    completedProjects: completedProjects.length,
    tasksCompleted: tasksCompleted.length,
    tasksCreated,
    tasksOverdue: overdueTasks.length,
    tasksBlocked: blockedTasks.length,
    commentsPosted,
  };

  const recommendations: string[] = [];
  if (metrics.tasksOverdue > 0)
    recommendations.push(
      `Address ${metrics.tasksOverdue} overdue task(s) — concentrated in ${topRisks.length} project(s).`,
    );
  if (stalledProjects.length)
    recommendations.push(
      `${stalledProjects.length} project(s) have had no activity in 2+ weeks — review or close.`,
    );
  if (metrics.tasksCreated > metrics.tasksCompleted * 1.5 && metrics.tasksCompleted > 0)
    recommendations.push(
      `Intake outpacing completion (${metrics.tasksCreated} new vs ${metrics.tasksCompleted} done) — consider capacity.`,
    );
  if (metrics.tasksCompleted === 0 && metrics.tasksCreated === 0)
    recommendations.push('No task activity this period — confirm teams are using the system.');
  if (!recommendations.length) recommendations.push('Operations look healthy across active projects.');

  let headline: string;
  if (metrics.tasksOverdue >= 10 || topRisks.length >= 3) {
    headline = `${topRisks.length} project(s) at risk, ${metrics.tasksOverdue} overdue task(s).`;
  } else if (metrics.tasksCompleted > 0) {
    headline = `${metrics.tasksCompleted} task(s) and ${metrics.completedProjects} project(s) completed in the last ${days} day(s).`;
  } else {
    headline = `Tracking ${metrics.activeProjects} active project(s).`;
  }

  return {
    period: { start: since.toISOString(), end: now.toISOString(), days },
    headline,
    metrics,
    completedHighlights: completedProjects
      .slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name, completedAt: p.completedAt!.toISOString() })),
    newProjects: newProjects.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
    })),
    topRisks,
    stalledProjects,
    byDepartment,
    recommendations,
  };
}

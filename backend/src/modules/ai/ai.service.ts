import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';
import {
  extractTasksFromText,
  scoreProjectRisk,
  summarizeProject,
} from './ai.heuristic';
import type { ExecutiveProjectRow, ExecutiveSummary, ProjectAIContext } from './ai.types';

const DAY_MS = 86_400_000;
const PROJECT_ACTIVE_STATUSES = ['active', 'not_started', 'on_hold'];
const TASK_OPEN_STATUSES = ['backlog', 'to_do', 'in_progress', 'waiting', 'review'];
const TASK_BLOCKED_STATUSES = ['waiting'];

async function loadContext(projectId: string): Promise<ProjectAIContext> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project not found');
  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      completedAt: true,
      updatedAt: true,
      assignedToId: true,
    },
  });
  const recentComments = await prisma.comment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { body: true, createdAt: true },
  });
  const dependencies = await prisma.taskDependency.findMany({
    where: { task: { projectId } },
    select: { taskId: true, dependsOnTaskId: true },
  });

  const lastActivityCandidates: Date[] = [project.updatedAt];
  for (const t of tasks) lastActivityCandidates.push(t.updatedAt);
  for (const c of recentComments) lastActivityCandidates.push(c.createdAt);
  const lastActivityAt = lastActivityCandidates.reduce((a, b) => (a > b ? a : b), project.updatedAt);

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      dueDate: project.dueDate,
      completedAt: project.completedAt,
      updatedAt: project.updatedAt,
    },
    tasks,
    recentComments,
    lastActivityAt,
    dependencies,
  };
}

export const aiService = {
  async summarizeProject(projectId: string) {
    const ctx = await loadContext(projectId);
    return summarizeProject(ctx);
  },

  async scoreProjectRisk(projectId: string) {
    const ctx = await loadContext(projectId);
    return scoreProjectRisk(ctx);
  },

  extractTasks(text: string) {
    return extractTasksFromText(text);
  },

  async executiveSummary(opts: { windowDays?: number; department?: string } = {}): Promise<ExecutiveSummary> {
    const windowDays = opts.windowDays ?? 7;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * DAY_MS);

    const projects = await prisma.project.findMany({
      where: {
        status: { in: PROJECT_ACTIVE_STATUSES },
        ...(opts.department ? { department: opts.department } : {}),
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
      },
    });

    const rows: ExecutiveProjectRow[] = [];
    let totalLoggedSeconds = 0;
    let totalCompletedThisWeek = 0;
    let totalOpenTasks = 0;
    let totalOverdueTasks = 0;
    let totalBlockedTasks = 0;

    for (const project of projects) {
      const ctx = await loadContext(project.id);
      const risk = scoreProjectRisk(ctx, now);

      const open = ctx.tasks.filter((t) => TASK_OPEN_STATUSES.includes(t.status));
      const overdue = open.filter((t) => t.dueDate && t.dueDate.getTime() < now.getTime());
      const blocked = ctx.tasks.filter((t) => TASK_BLOCKED_STATUSES.includes(t.status));
      const completed = ctx.tasks.filter((t) => t.status === 'done');
      const completedThisWeek = ctx.tasks.filter(
        (t) => t.completedAt && t.completedAt.getTime() >= windowStart.getTime(),
      ).length;

      const timeAgg = await prisma.timeEntry.aggregate({
        where: {
          task: { projectId: project.id },
          startedAt: { gte: windowStart },
          durationSeconds: { not: null },
        },
        _sum: { durationSeconds: true },
      });
      const loggedSeconds = timeAgg._sum.durationSeconds ?? 0;

      const daysToDue = project.dueDate
        ? Math.floor((project.dueDate.getTime() - now.getTime()) / DAY_MS)
        : null;

      const row: ExecutiveProjectRow = {
        projectId: project.id,
        name: project.name,
        status: project.status,
        department: project.department,
        ownerName: project.owner?.displayName ?? null,
        dueDate: project.dueDate ? project.dueDate.toISOString() : null,
        daysToDue,
        risk,
        totalTasks: ctx.tasks.length,
        openTasks: open.length,
        overdueTasks: overdue.length,
        blockedTasks: blocked.length,
        completedTasks: completed.length,
        loggedSeconds,
        taskCompletionsThisWeek: completedThisWeek,
        recentlyUpdatedAt: ctx.lastActivityAt.toISOString(),
      };
      rows.push(row);

      totalLoggedSeconds += loggedSeconds;
      totalCompletedThisWeek += completedThisWeek;
      totalOpenTasks += open.length;
      totalOverdueTasks += overdue.length;
      totalBlockedTasks += blocked.length;
    }

    const attention = rows
      .slice()
      .sort((a, b) => b.risk.score - a.risk.score)
      .slice(0, 5);
    const movers = rows
      .slice()
      .filter((r) => r.taskCompletionsThisWeek > 0)
      .sort((a, b) => b.taskCompletionsThisWeek - a.taskCompletionsThisWeek)
      .slice(0, 5);
    const stalled = rows
      .slice()
      .filter(
        (r) =>
          r.status === 'active' &&
          new Date(r.recentlyUpdatedAt).getTime() < now.getTime() - windowDays * DAY_MS,
      )
      .sort((a, b) => new Date(a.recentlyUpdatedAt).getTime() - new Date(b.recentlyUpdatedAt).getTime())
      .slice(0, 5);

    const deptBuckets = new Map<
      string,
      { activeProjects: number; openTasks: number; overdueTasks: number }
    >();
    for (const r of rows) {
      const key = r.department ?? '—';
      const b = deptBuckets.get(key) ?? { activeProjects: 0, openTasks: 0, overdueTasks: 0 };
      b.activeProjects += 1;
      b.openTasks += r.openTasks;
      b.overdueTasks += r.overdueTasks;
      deptBuckets.set(key, b);
    }
    const byDepartment = Array.from(deptBuckets.entries())
      .map(([department, b]) => ({ department, ...b }))
      .sort((a, b) => b.activeProjects - a.activeProjects);

    let headline: string;
    if (rows.length === 0) {
      headline = 'No active projects in the selected window.';
    } else if (totalOverdueTasks > 0) {
      headline = `${totalOverdueTasks} overdue task(s) across ${rows.length} active project(s) — ${attention[0]?.name ?? ''} is the highest-risk project.`;
    } else if (totalCompletedThisWeek > 0) {
      headline = `${totalCompletedThisWeek} task(s) completed this week across ${rows.length} active project(s).`;
    } else {
      headline = `${rows.length} active project(s); no overdue work.`;
    }

    return {
      generatedAt: now.toISOString(),
      windowDays,
      headline,
      totals: {
        activeProjects: rows.length,
        openTasks: totalOpenTasks,
        overdueTasks: totalOverdueTasks,
        blockedTasks: totalBlockedTasks,
        completedThisWeek: totalCompletedThisWeek,
        loggedHoursThisWeek: Math.round((totalLoggedSeconds / 3600) * 10) / 10,
      },
      attention,
      movers,
      stalled,
      byDepartment,
    };
  },
};

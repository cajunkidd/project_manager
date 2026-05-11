import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';
import { buildExecSummary, type ExecSummaryOptions } from './ai.exec';
import {
  extractTasksFromText,
  scoreProjectRisk,
  summarizeProject,
} from './ai.heuristic';
import {
  findDuplicateTasks,
  loadTasksForSuggestions,
  suggestCleanup,
  suggestPriorities,
} from './ai.suggestions';
import { parseMeetingNotes } from './ai.meetings';
import { summarizeEmailThread, type EmailMessage } from './ai.email';
import type { ProjectAIContext } from './ai.types';

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

  async execSummary(opts: ExecSummaryOptions = {}) {
    return buildExecSummary(opts);
  },

  async prioritize(projectId?: string) {
    const tasks = await loadTasksForSuggestions(projectId);
    return { suggestions: suggestPriorities(tasks) };
  },

  async cleanup(projectId?: string) {
    const tasks = await loadTasksForSuggestions(projectId);
    return { suggestions: suggestCleanup(tasks) };
  },

  async duplicates(projectId?: string, threshold = 0.6) {
    const tasks = await loadTasksForSuggestions(projectId);
    return { threshold, groups: findDuplicateTasks(tasks, threshold) };
  },

  parseMeetingNotes(text: string) {
    return parseMeetingNotes(text);
  },

  summarizeEmail(thread: EmailMessage[]) {
    return summarizeEmailThread(thread);
  },
};

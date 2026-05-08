import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';
import { getAIProvider } from './ai.providers';
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
    return getAIProvider().summarizeProject(ctx);
  },

  async scoreProjectRisk(projectId: string) {
    const ctx = await loadContext(projectId);
    return getAIProvider().scoreProjectRisk(ctx);
  },

  async extractTasks(text: string) {
    return getAIProvider().extractTasks(text);
  },

  providerName(): string {
    return getAIProvider().name;
  },
};

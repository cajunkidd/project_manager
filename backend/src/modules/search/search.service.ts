import { prisma } from '../../db/prisma';

export interface SearchHit {
  type: 'task' | 'project' | 'comment';
  id: string;
  title: string;
  snippet: string | null;
  status?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  taskId?: string | null;
  url: string;
  updatedAt: string;
}

export interface SearchResults {
  tasks: SearchHit[];
  projects: SearchHit[];
  comments: SearchHit[];
}

const PER_KIND_LIMIT = 20;

function makeSnippet(body: string, query: string): string {
  if (!body) return '';
  const lower = body.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return body.slice(0, 140);
  const start = Math.max(0, idx - 40);
  const end = Math.min(body.length, idx + query.length + 60);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < body.length ? '…' : '';
  return `${prefix}${body.slice(start, end)}${suffix}`;
}

export const searchService = {
  async search(query: string): Promise<SearchResults> {
    const q = query.trim();
    if (!q) return { tasks: [], projects: [], comments: [] };
    const contains = { contains: q, mode: 'insensitive' as const };

    const [tasks, projects, comments] = await Promise.all([
      prisma.task.findMany({
        where: { OR: [{ title: contains }, { description: contains }] },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND_LIMIT,
        include: {
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.project.findMany({
        where: { OR: [{ name: contains }, { description: contains }] },
        orderBy: { updatedAt: 'desc' },
        take: PER_KIND_LIMIT,
      }),
      prisma.comment.findMany({
        where: { body: contains },
        orderBy: { createdAt: 'desc' },
        take: PER_KIND_LIMIT,
        include: {
          task: { select: { id: true, title: true } },
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      tasks: tasks.map((t) => ({
        type: 'task',
        id: t.id,
        title: t.title,
        snippet: t.description ? makeSnippet(t.description, q) : null,
        status: t.status,
        projectId: t.projectId,
        projectName: t.project?.name ?? null,
        url: `/tasks/${t.id}`,
        updatedAt: t.updatedAt.toISOString(),
      })),
      projects: projects.map((p) => ({
        type: 'project',
        id: p.id,
        title: p.name,
        snippet: p.description ? makeSnippet(p.description, q) : null,
        status: p.status,
        url: `/projects/${p.id}`,
        updatedAt: p.updatedAt.toISOString(),
      })),
      comments: comments.map((c) => ({
        type: 'comment',
        id: c.id,
        title: c.task?.title ?? c.project?.name ?? 'Comment',
        snippet: makeSnippet(c.body, q),
        projectId: c.projectId ?? c.task ? null : c.projectId,
        projectName: c.project?.name ?? null,
        taskId: c.taskId,
        url: c.taskId ? `/tasks/${c.taskId}` : c.projectId ? `/projects/${c.projectId}` : '#',
        updatedAt: c.createdAt.toISOString(),
      })),
    };
  },
};

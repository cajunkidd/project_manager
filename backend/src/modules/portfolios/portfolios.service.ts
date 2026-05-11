import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';

export interface CreatePortfolioInput {
  name: string;
  description?: string | null;
  color?: string | null;
  ownerId?: string | null;
  projectIds?: string[];
}

export interface UpdatePortfolioInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  ownerId?: string | null;
}

const PORTFOLIO_INCLUDE = {
  owner: { select: { id: true, displayName: true, email: true } },
  projects: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
        },
      },
    },
  },
} as const;

export const portfoliosService = {
  async list() {
    return prisma.portfolio.findMany({
      orderBy: { name: 'asc' },
      include: PORTFOLIO_INCLUDE,
    });
  },

  async getById(id: string) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: PORTFOLIO_INCLUDE,
    });
    if (!portfolio) throw new NotFoundError('Portfolio not found');
    return portfolio;
  },

  async create(input: CreatePortfolioInput) {
    return prisma.portfolio.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        ownerId: input.ownerId ?? null,
        projects: input.projectIds?.length
          ? {
              create: input.projectIds.map((pid, idx) => ({
                projectId: pid,
                sortOrder: idx,
              })),
            }
          : undefined,
      },
      include: PORTFOLIO_INCLUDE,
    });
  },

  async update(id: string, input: UpdatePortfolioInput) {
    await this.getById(id);
    return prisma.portfolio.update({
      where: { id },
      data: input,
      include: PORTFOLIO_INCLUDE,
    });
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.portfolio.delete({ where: { id } });
  },

  async addProject(portfolioId: string, projectId: string) {
    await this.getById(portfolioId);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');
    try {
      return await prisma.portfolioProject.create({
        data: { portfolioId, projectId },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        throw new ConflictError('Project is already in this portfolio');
      }
      throw err;
    }
  },

  async removeProject(portfolioId: string, projectId: string) {
    const link = await prisma.portfolioProject.findUnique({
      where: { portfolioId_projectId: { portfolioId, projectId } },
    });
    if (!link) throw new NotFoundError('Project not in portfolio');
    await prisma.portfolioProject.delete({ where: { id: link.id } });
  },

  async summary(id: string) {
    const portfolio = await this.getById(id);
    const projectIds = portfolio.projects.map((pp) => pp.project.id);

    if (projectIds.length === 0) {
      return {
        portfolio: { id: portfolio.id, name: portfolio.name },
        projectCount: 0,
        projectsByStatus: {},
        taskCount: 0,
        completedTasks: 0,
        overdueTasks: 0,
        completionPct: 0,
        minutesLogged: 0,
      };
    }

    const [tasks, timeAgg] = await Promise.all([
      prisma.task.findMany({
        where: { projectId: { in: projectIds } },
        select: { status: true, dueDate: true, completedAt: true },
      }),
      prisma.timeEntry.aggregate({
        where: { task: { projectId: { in: projectIds } } },
        _sum: { minutes: true },
      }),
    ]);

    const now = Date.now();
    let completed = 0;
    let overdue = 0;
    for (const t of tasks) {
      if (t.status === 'done') completed += 1;
      if (
        t.dueDate &&
        t.dueDate.getTime() < now &&
        t.status !== 'done' &&
        t.status !== 'cancelled'
      ) {
        overdue += 1;
      }
    }
    const projectsByStatus = portfolio.projects.reduce<Record<string, number>>((acc, pp) => {
      acc[pp.project.status] = (acc[pp.project.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      portfolio: { id: portfolio.id, name: portfolio.name },
      projectCount: portfolio.projects.length,
      projectsByStatus,
      taskCount: tasks.length,
      completedTasks: completed,
      overdueTasks: overdue,
      completionPct:
        tasks.length === 0 ? 0 : Number(((completed / tasks.length) * 100).toFixed(1)),
      minutesLogged: timeAgg._sum.minutes ?? 0,
    };
  },
};

import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';

export interface CreatePortfolioInput {
  name: string;
  description?: string | null;
  ownerId?: string | null;
}

export const portfoliosService = {
  list() {
    return prisma.portfolio.findMany({
      orderBy: { name: 'asc' },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        _count: { select: { projects: true } },
      },
    });
  },

  async getById(id: string) {
    const p = await prisma.portfolio.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            dueDate: true,
            completedAt: true,
            budgetAmount: true,
            budgetCurrency: true,
          },
        },
      },
    });
    if (!p) throw new NotFoundError('Portfolio not found');
    return p;
  },

  create(input: CreatePortfolioInput) {
    return prisma.portfolio.create({ data: input });
  },

  async update(id: string, input: Partial<CreatePortfolioInput>) {
    await this.getById(id);
    return prisma.portfolio.update({ where: { id }, data: input });
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.portfolio.delete({ where: { id } });
  },

  async rollup(id: string) {
    const p = await this.getById(id);
    const total = p.projects.length;
    const byStatus = p.projects.reduce<Record<string, number>>((acc, proj) => {
      acc[proj.status] = (acc[proj.status] ?? 0) + 1;
      return acc;
    }, {});
    const budgetTotal = p.projects.reduce((sum, proj) => sum + (proj.budgetAmount ?? 0), 0);
    const overdue = p.projects.filter(
      (proj) => proj.dueDate && !proj.completedAt && new Date(proj.dueDate) < new Date(),
    ).length;
    return { portfolioId: id, total, byStatus, budgetTotal, overdue };
  },
};

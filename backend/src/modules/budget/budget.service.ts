import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';

export const BUDGET_KINDS = ['planned', 'actual'] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];

export interface CreateBudgetEntryInput {
  projectId: string;
  kind: BudgetKind;
  amount: number;
  description?: string | null;
  occurredAt?: Date;
}

export const budgetService = {
  list(projectId: string) {
    return prisma.budgetEntry.findMany({
      where: { projectId },
      orderBy: { occurredAt: 'desc' },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });
  },

  async create(input: CreateBudgetEntryInput, userId?: string) {
    if (!BUDGET_KINDS.includes(input.kind)) throw new ValidationError('Invalid kind');
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new NotFoundError('Project not found');
    return prisma.budgetEntry.create({
      data: {
        projectId: input.projectId,
        kind: input.kind,
        amount: input.amount,
        description: input.description ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        createdById: userId ?? null,
      },
    });
  },

  async remove(id: string) {
    const e = await prisma.budgetEntry.findUnique({ where: { id } });
    if (!e) throw new NotFoundError('Entry not found');
    await prisma.budgetEntry.delete({ where: { id } });
  },

  async rollup(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');
    const entries = await prisma.budgetEntry.findMany({ where: { projectId } });
    const planned = entries
      .filter((e) => e.kind === 'planned')
      .reduce((sum, e) => sum + e.amount, 0);
    const actual = entries
      .filter((e) => e.kind === 'actual')
      .reduce((sum, e) => sum + e.amount, 0);
    const budget = project.budgetAmount ?? null;
    return {
      projectId,
      currency: project.budgetCurrency ?? 'USD',
      budget,
      planned,
      actual,
      remaining: budget !== null ? budget - actual : null,
      utilization: budget !== null && budget > 0 ? actual / budget : null,
    };
  },
};

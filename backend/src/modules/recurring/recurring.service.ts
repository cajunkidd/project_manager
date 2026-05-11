import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { tasksService } from '../tasks/tasks.service';

export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

function advance(from: Date, frequency: RecurringFrequency): Date {
  const next = new Date(from);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export interface CreateRuleInput {
  name: string;
  projectId?: string | null;
  templateTitle: string;
  templateDesc?: string | null;
  templatePriority?: string;
  assignedToId?: string | null;
  frequency: RecurringFrequency;
  nextRunAt: Date;
}

export const recurringService = {
  list(filters: { projectId?: string; isActive?: boolean } = {}) {
    return prisma.recurringTaskRule.findMany({
      where: {
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      orderBy: { nextRunAt: 'asc' },
    });
  },

  async getById(id: string) {
    const r = await prisma.recurringTaskRule.findUnique({ where: { id } });
    if (!r) throw new NotFoundError('Rule not found');
    return r;
  },

  async create(input: CreateRuleInput, userId?: string) {
    if (!RECURRING_FREQUENCIES.includes(input.frequency)) {
      throw new ValidationError('Invalid frequency');
    }
    return prisma.recurringTaskRule.create({
      data: {
        name: input.name,
        projectId: input.projectId ?? null,
        templateTitle: input.templateTitle,
        templateDesc: input.templateDesc ?? null,
        templatePriority: input.templatePriority ?? 'normal',
        assignedToId: input.assignedToId ?? null,
        frequency: input.frequency,
        nextRunAt: input.nextRunAt,
        createdById: userId ?? null,
      },
    });
  },

  async update(id: string, input: Partial<CreateRuleInput> & { isActive?: boolean }) {
    await this.getById(id);
    return prisma.recurringTaskRule.update({ where: { id }, data: input });
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.recurringTaskRule.delete({ where: { id } });
  },

  async runDue(now: Date = new Date()) {
    const due = await prisma.recurringTaskRule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
    });
    const created: string[] = [];
    for (const rule of due) {
      const task = await tasksService.create({
        projectId: rule.projectId,
        title: rule.templateTitle,
        description: rule.templateDesc,
        priority: rule.templatePriority,
        assignedToId: rule.assignedToId,
      }, rule.createdById ?? undefined);
      created.push(task.id);
      const nextRunAt = advance(rule.nextRunAt, rule.frequency as RecurringFrequency);
      await prisma.recurringTaskRule.update({
        where: { id: rule.id },
        data: { nextRunAt, lastRunAt: now },
      });
    }
    return { ranRules: due.length, createdTaskIds: created };
  },
};

let timer: ReturnType<typeof setInterval> | null = null;

export function startRecurringScheduler(intervalMs = 60_000): void {
  if (timer) return;
  if (process.env.NODE_ENV === 'test') return;
  timer = setInterval(() => {
    recurringService.runDue().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Recurring scheduler failed:', err);
    });
  }, intervalMs);
}

export function stopRecurringScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

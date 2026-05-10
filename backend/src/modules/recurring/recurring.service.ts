import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { tasksService } from '../tasks/tasks.service';
import { computeNextRunAt, type Cadence } from './recurring.cadence';

const TEMPLATE_INCLUDE = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, displayName: true, email: true } },
} as const;

export interface CreateTemplateInput {
  name: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  assigneeId?: string | null;
  priority?: string;
  cadence: Cadence;
  intervalCount?: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hourOfDay?: number;
  dueOffsetDays?: number;
  startAt?: Date | null;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput> & { isActive?: boolean };

function validateCadence(input: {
  cadence: Cadence;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  intervalCount?: number;
  hourOfDay?: number;
}): void {
  if (input.cadence === 'weekly' && input.dayOfWeek != null) {
    if (input.dayOfWeek < 0 || input.dayOfWeek > 6)
      throw new ValidationError('dayOfWeek must be 0..6');
  }
  if (input.cadence === 'monthly' && input.dayOfMonth != null) {
    if (input.dayOfMonth < 1 || input.dayOfMonth > 31)
      throw new ValidationError('dayOfMonth must be 1..31');
  }
  if (input.intervalCount != null && input.intervalCount < 1) {
    throw new ValidationError('intervalCount must be >= 1');
  }
  if (input.hourOfDay != null && (input.hourOfDay < 0 || input.hourOfDay > 23)) {
    throw new ValidationError('hourOfDay must be 0..23');
  }
}

export const recurringService = {
  async list() {
    return prisma.recurringTaskTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: TEMPLATE_INCLUDE,
    });
  },

  async get(id: string) {
    const t = await prisma.recurringTaskTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!t) throw new NotFoundError('Template not found');
    return t;
  },

  async create(input: CreateTemplateInput, userId?: string) {
    validateCadence(input);
    const cfg = {
      cadence: input.cadence,
      intervalCount: input.intervalCount ?? 1,
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      hourOfDay: input.hourOfDay ?? 9,
    };
    const seed = input.startAt ?? new Date();
    // For seed dates clearly in the future, honor them; otherwise compute next from now.
    const nextRunAt =
      input.startAt && input.startAt.getTime() > Date.now()
        ? input.startAt
        : computeNextRunAt(cfg, seed);

    return prisma.recurringTaskTemplate.create({
      data: {
        name: input.name,
        title: input.title,
        description: input.description ?? null,
        projectId: input.projectId ?? null,
        assigneeId: input.assigneeId ?? null,
        priority: input.priority ?? 'normal',
        cadence: input.cadence,
        intervalCount: cfg.intervalCount,
        dayOfWeek: cfg.dayOfWeek,
        dayOfMonth: cfg.dayOfMonth,
        hourOfDay: cfg.hourOfDay,
        dueOffsetDays: input.dueOffsetDays ?? 0,
        nextRunAt,
        createdById: userId ?? null,
      },
      include: TEMPLATE_INCLUDE,
    });
  },

  async update(id: string, input: UpdateTemplateInput) {
    await this.get(id);
    if (input.cadence || input.dayOfWeek != null || input.dayOfMonth != null || input.intervalCount != null) {
      const merged = await prisma.recurringTaskTemplate.findUnique({ where: { id } });
      validateCadence({
        cadence: (input.cadence ?? merged!.cadence) as Cadence,
        dayOfWeek: input.dayOfWeek ?? merged!.dayOfWeek,
        dayOfMonth: input.dayOfMonth ?? merged!.dayOfMonth,
        intervalCount: input.intervalCount ?? merged!.intervalCount,
        hourOfDay: input.hourOfDay ?? merged!.hourOfDay,
      });
    }
    return prisma.recurringTaskTemplate.update({
      where: { id },
      data: input,
      include: TEMPLATE_INCLUDE,
    });
  },

  async remove(id: string) {
    await this.get(id);
    await prisma.recurringTaskTemplate.delete({ where: { id } });
  },

  async runDue(now = new Date(), userId?: string) {
    const due = await prisma.recurringTaskTemplate.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
    });
    const created: string[] = [];
    for (const t of due) {
      const dueDate = t.dueOffsetDays > 0
        ? new Date(now.getTime() + t.dueOffsetDays * 86_400_000)
        : null;
      const task = await tasksService.create(
        {
          projectId: t.projectId ?? null,
          title: t.title,
          description: t.description ?? null,
          priority: t.priority,
          assignedToId: t.assigneeId ?? null,
          dueDate,
        },
        userId ?? t.createdById ?? undefined,
      );
      const cfg = {
        cadence: t.cadence as Cadence,
        intervalCount: t.intervalCount,
        dayOfWeek: t.dayOfWeek,
        dayOfMonth: t.dayOfMonth,
        hourOfDay: t.hourOfDay,
      };
      const nextRunAt = computeNextRunAt(cfg, now);
      await prisma.recurringTaskTemplate.update({
        where: { id: t.id },
        data: { lastRunAt: now, nextRunAt },
      });
      created.push(task.id);
    }
    return { ranTemplates: due.length, createdTaskIds: created };
  },
};

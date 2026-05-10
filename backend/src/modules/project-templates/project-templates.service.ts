import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { NotFoundError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

export interface TemplateTaskInput {
  title: string;
  description?: string | null;
  priority?: string;
  dueOffsetDays?: number;
  sortOrder?: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  defaultPriority?: string;
  department?: string | null;
  tasks?: TemplateTaskInput[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  defaultPriority?: string;
  department?: string | null;
  isActive?: boolean;
  tasks?: TemplateTaskInput[];
}

export interface InstantiateInput {
  name: string;
  description?: string | null;
  ownerId?: string | null;
  startDate?: Date | null;
}

const TEMPLATE_INCLUDE = {
  tasks: { orderBy: { sortOrder: 'asc' as const } },
  createdBy: { select: { id: true, displayName: true, email: true } },
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const projectTemplatesService = {
  async list() {
    return prisma.projectTemplate.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: TEMPLATE_INCLUDE,
    });
  },

  async getById(id: string) {
    const tpl = await prisma.projectTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!tpl) throw new NotFoundError('Template not found');
    return tpl;
  },

  async create(input: CreateTemplateInput, userId?: string) {
    return prisma.projectTemplate.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        defaultPriority: input.defaultPriority ?? 'normal',
        department: input.department ?? null,
        createdById: userId ?? null,
        tasks: input.tasks?.length
          ? {
              create: input.tasks.map((t, idx) => ({
                title: t.title,
                description: t.description ?? null,
                priority: t.priority ?? 'normal',
                dueOffsetDays: t.dueOffsetDays ?? 0,
                sortOrder: t.sortOrder ?? idx,
              })),
            }
          : undefined,
      },
      include: TEMPLATE_INCLUDE,
    });
  },

  async update(id: string, input: UpdateTemplateInput) {
    await this.getById(id);
    return prisma.$transaction(async (tx) => {
      await tx.projectTemplate.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          defaultPriority: input.defaultPriority,
          department: input.department,
          isActive: input.isActive,
        },
      });
      if (input.tasks) {
        await tx.projectTemplateTask.deleteMany({ where: { templateId: id } });
        if (input.tasks.length > 0) {
          await tx.projectTemplateTask.createMany({
            data: input.tasks.map((t, idx) => ({
              templateId: id,
              title: t.title,
              description: t.description ?? null,
              priority: t.priority ?? 'normal',
              dueOffsetDays: t.dueOffsetDays ?? 0,
              sortOrder: t.sortOrder ?? idx,
            })),
          });
        }
      }
      return tx.projectTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });
    });
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.projectTemplate.delete({ where: { id } });
  },

  async instantiate(id: string, input: InstantiateInput, userId?: string) {
    const tpl = await this.getById(id);

    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description ?? tpl.description,
        ownerId: input.ownerId ?? null,
        priority: tpl.defaultPriority,
        department: tpl.department,
        startDate: input.startDate ?? null,
        createdById: userId ?? null,
      },
    });

    const baseDate = input.startDate ?? new Date();
    const createdTasks = [];
    for (const t of tpl.tasks) {
      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          sortOrder: t.sortOrder,
          dueDate: t.dueOffsetDays > 0 ? addDays(baseDate, t.dueOffsetDays) : null,
          createdById: userId ?? null,
        },
      });
      createdTasks.push(task);
    }

    await activityService.log({
      entityType: 'project',
      entityId: project.id,
      action: 'created_from_template',
      newValue: { templateId: tpl.id, templateName: tpl.name, taskCount: createdTasks.length },
      userId: userId ?? null,
    });
    await eventBus.emit({ type: 'project.created', project, actorId: userId ?? null });
    for (const task of createdTasks) {
      await eventBus.emit({ type: 'task.created', task, actorId: userId ?? null });
    }

    return { project, taskCount: createdTasks.length };
  },
};

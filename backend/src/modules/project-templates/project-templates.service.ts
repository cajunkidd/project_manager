import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const DAY_MS = 86_400_000;

const TEMPLATE_INCLUDE = {
  tasks: { orderBy: { sortOrder: 'asc' as const } },
  createdBy: { select: { id: true, displayName: true, email: true } },
} as const;

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  department?: string | null;
  defaultPriority?: string;
  tasks?: Array<{
    title: string;
    description?: string | null;
    priority?: string;
    startOffsetDays?: number | null;
    dueOffsetDays?: number | null;
    parentIndex?: number | null; // index into the same array; useful for client-side authoring
    sortOrder?: number;
  }>;
}

export interface InstantiateInput {
  name: string;
  description?: string | null;
  ownerId?: string | null;
  department?: string | null;
  priority?: string;
  startDate: Date; // template offsets are relative to this
}

function offsetDays(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export const projectTemplatesService = {
  async list() {
    return prisma.projectTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, displayName: true, email: true } } },
    });
  },

  async get(id: string) {
    const t = await prisma.projectTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!t) throw new NotFoundError('Template not found');
    return t;
  },

  async create(input: CreateTemplateInput, userId?: string) {
    const tasks = input.tasks ?? [];
    // Two-pass create so subtasks can reference their parent's row id.
    const template = await prisma.projectTemplate.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        department: input.department ?? null,
        defaultPriority: input.defaultPriority ?? 'normal',
        createdById: userId ?? null,
      },
    });

    const ids: string[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const parent = t.parentIndex != null ? ids[t.parentIndex] ?? null : null;
      const created = await prisma.projectTemplateTask.create({
        data: {
          templateId: template.id,
          parentTemplateTaskId: parent,
          title: t.title,
          description: t.description ?? null,
          priority: t.priority ?? input.defaultPriority ?? 'normal',
          startOffsetDays: t.startOffsetDays ?? null,
          dueOffsetDays: t.dueOffsetDays ?? null,
          sortOrder: t.sortOrder ?? i,
        },
      });
      ids.push(created.id);
    }
    return this.get(template.id);
  },

  async remove(id: string) {
    await this.get(id);
    await prisma.projectTemplate.delete({ where: { id } });
  },

  /**
   * Snapshots an existing project's name/desc/tasks (and subtask tree) into a
   * new template. Date offsets are computed relative to the project's
   * startDate; tasks without dates store null offsets.
   */
  async snapshotFromProject(projectId: string, name: string, userId?: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');
    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: [{ parentTaskId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const baseDate = project.startDate ?? null;
    const template = await prisma.projectTemplate.create({
      data: {
        name,
        description: project.description ?? null,
        department: project.department ?? null,
        defaultPriority: project.priority,
        createdById: userId ?? null,
      },
    });

    // Build template tasks in two passes so parent_task_id maps to template ids.
    const taskIdToTemplateId = new Map<string, string>();
    // Pass 1: top-level tasks
    for (const t of tasks.filter((t) => !t.parentTaskId)) {
      const created = await prisma.projectTemplateTask.create({
        data: {
          templateId: template.id,
          parentTemplateTaskId: null,
          title: t.title,
          description: t.description ?? null,
          priority: t.priority,
          startOffsetDays: offsetDays(baseDate, t.startDate),
          dueOffsetDays: offsetDays(baseDate, t.dueDate),
          sortOrder: t.sortOrder,
        },
      });
      taskIdToTemplateId.set(t.id, created.id);
    }
    // Pass 2..N: walk remaining levels until all are placed.
    let pending = tasks.filter((t) => t.parentTaskId);
    while (pending.length) {
      const next: typeof pending = [];
      for (const t of pending) {
        const parentTplId = t.parentTaskId ? taskIdToTemplateId.get(t.parentTaskId) : null;
        if (!parentTplId) {
          next.push(t); // parent not placed yet
          continue;
        }
        const created = await prisma.projectTemplateTask.create({
          data: {
            templateId: template.id,
            parentTemplateTaskId: parentTplId,
            title: t.title,
            description: t.description ?? null,
            priority: t.priority,
            startOffsetDays: offsetDays(baseDate, t.startDate),
            dueOffsetDays: offsetDays(baseDate, t.dueDate),
            sortOrder: t.sortOrder,
          },
        });
        taskIdToTemplateId.set(t.id, created.id);
      }
      if (next.length === pending.length) {
        // Shouldn't happen unless there's an orphaned subtask; bail to avoid infinite loop.
        break;
      }
      pending = next;
    }

    await activityService.log({
      entityType: 'project',
      entityId: projectId,
      action: 'template_snapshot',
      newValue: { templateId: template.id, name },
      userId: userId ?? null,
    });

    return this.get(template.id);
  },

  /**
   * Instantiates a template into a brand-new project. Computes startDate /
   * dueDate per task as `input.startDate + offsetDays`.
   */
  async instantiate(templateId: string, input: InstantiateInput, userId?: string) {
    const template = await this.get(templateId);
    if (!input.startDate) throw new ValidationError('startDate is required');

    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description ?? template.description ?? null,
        ownerId: input.ownerId ?? null,
        department: input.department ?? template.department ?? null,
        priority: input.priority ?? template.defaultPriority,
        startDate: input.startDate,
        createdById: userId ?? null,
      },
    });

    const tplToTaskId = new Map<string, string>();
    let remaining = [...template.tasks];
    while (remaining.length) {
      const next: typeof remaining = [];
      for (const tt of remaining) {
        if (tt.parentTemplateTaskId && !tplToTaskId.has(tt.parentTemplateTaskId)) {
          next.push(tt);
          continue;
        }
        const start = tt.startOffsetDays != null
          ? new Date(input.startDate.getTime() + tt.startOffsetDays * DAY_MS)
          : null;
        const due = tt.dueOffsetDays != null
          ? new Date(input.startDate.getTime() + tt.dueOffsetDays * DAY_MS)
          : null;
        const created = await prisma.task.create({
          data: {
            projectId: project.id,
            parentTaskId: tt.parentTemplateTaskId
              ? tplToTaskId.get(tt.parentTemplateTaskId) ?? null
              : null,
            title: tt.title,
            description: tt.description ?? null,
            priority: tt.priority,
            startDate: start,
            dueDate: due,
            sortOrder: tt.sortOrder,
            createdById: userId ?? null,
          },
        });
        tplToTaskId.set(tt.id, created.id);
      }
      if (next.length === remaining.length) break;
      remaining = next;
    }

    await activityService.log({
      entityType: 'project',
      entityId: project.id,
      action: 'instantiated_from_template',
      newValue: { templateId, taskCount: tplToTaskId.size },
      userId: userId ?? null,
    });

    return prisma.project.findUnique({
      where: { id: project.id },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        _count: { select: { tasks: true } },
      },
    });
  },
};

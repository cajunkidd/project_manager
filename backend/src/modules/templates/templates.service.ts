import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';
import { membersService } from '../members/members.service';

interface TemplateTaskNode {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  sortOrder?: number;
  offsetDaysFromStart?: number | null;
  subtasks?: TemplateTaskNode[];
}

interface TemplatePayload {
  project: {
    name: string;
    description?: string | null;
    priority?: string;
    department?: string | null;
    budgetAmount?: number | null;
    budgetCurrency?: string | null;
  };
  tasks: TemplateTaskNode[];
}

function safeParse(payload: string): TemplatePayload {
  try {
    return JSON.parse(payload) as TemplatePayload;
  } catch {
    return { project: { name: 'Untitled' }, tasks: [] };
  }
}

function buildTaskTree(tasks: Array<{ id: string; parentTaskId: string | null; title: string; description: string | null; priority: string; sortOrder: number }>) {
  const byParent = new Map<string | null, typeof tasks>();
  for (const t of tasks) {
    const list = byParent.get(t.parentTaskId) ?? [];
    list.push(t);
    byParent.set(t.parentTaskId, list);
  }
  function walk(parentId: string | null): TemplateTaskNode[] {
    const children = (byParent.get(parentId) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    return children.map((c) => ({
      title: c.title,
      description: c.description,
      priority: c.priority,
      sortOrder: c.sortOrder,
      subtasks: walk(c.id),
    }));
  }
  return walk(null);
}

export const templatesService = {
  list() {
    return prisma.projectTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });
  },

  async getById(id: string) {
    const t = await prisma.projectTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundError('Template not found');
    return t;
  },

  async createFromProject(projectId: string, name: string, description: string | null, userId?: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { tasks: true },
    });
    if (!project) throw new NotFoundError('Project not found');
    const payload: TemplatePayload = {
      project: {
        name: project.name,
        description: project.description,
        priority: project.priority,
        department: project.department,
        budgetAmount: project.budgetAmount,
        budgetCurrency: project.budgetCurrency,
      },
      tasks: buildTaskTree(project.tasks),
    };
    return prisma.projectTemplate.create({
      data: {
        name,
        description,
        payload: JSON.stringify(payload),
        createdById: userId ?? null,
      },
    });
  },

  async createRaw(name: string, description: string | null, payload: TemplatePayload, userId?: string) {
    return prisma.projectTemplate.create({
      data: {
        name,
        description,
        payload: JSON.stringify(payload),
        createdById: userId ?? null,
      },
    });
  },

  async instantiate(
    templateId: string,
    overrides: { name?: string; department?: string | null; startDate?: Date | null },
    userId?: string,
  ) {
    const template = await this.getById(templateId);
    const payload = safeParse(template.payload);
    const startDate = overrides.startDate ?? null;

    const project = await prisma.project.create({
      data: {
        name: overrides.name ?? payload.project.name,
        description: payload.project.description ?? null,
        priority: payload.project.priority ?? 'normal',
        department: overrides.department ?? payload.project.department ?? null,
        budgetAmount: payload.project.budgetAmount ?? null,
        budgetCurrency: payload.project.budgetCurrency ?? 'USD',
        startDate,
        createdById: userId ?? null,
      },
    });
    if (userId) {
      await membersService.ensureOwnerSeeded(project.id, userId);
    }

    async function createTasks(nodes: TemplateTaskNode[], parentId: string | null) {
      for (const node of nodes) {
        const dueDate =
          startDate && typeof node.offsetDaysFromStart === 'number'
            ? new Date(startDate.getTime() + node.offsetDaysFromStart * 86_400_000)
            : null;
        const t = await prisma.task.create({
          data: {
            projectId: project.id,
            parentTaskId: parentId,
            title: node.title,
            description: node.description ?? null,
            priority: node.priority ?? 'normal',
            sortOrder: node.sortOrder ?? 0,
            dueDate,
            createdById: userId ?? null,
          },
        });
        if (node.subtasks?.length) {
          await createTasks(node.subtasks, t.id);
        }
      }
    }
    await createTasks(payload.tasks, null);
    return project;
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.projectTemplate.delete({ where: { id } });
  },
};

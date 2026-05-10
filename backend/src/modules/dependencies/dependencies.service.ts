import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const OPEN_TASK_STATUSES = new Set([
  'backlog',
  'to_do',
  'in_progress',
  'waiting',
  'review',
]);

async function wouldCreateCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  if (taskId === dependsOnTaskId) return true;
  const visited = new Set<string>();
  const stack = [dependsOnTaskId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const edges = await prisma.taskDependency.findMany({
      where: { taskId: current },
      select: { dependsOnTaskId: true },
    });
    for (const edge of edges) stack.push(edge.dependsOnTaskId);
  }
  return false;
}

const DEP_INCLUDE = {
  dependsOnTask: {
    select: { id: true, title: true, status: true, priority: true, dueDate: true },
  },
  task: {
    select: { id: true, title: true, status: true, priority: true, dueDate: true },
  },
} as const;

export const dependenciesService = {
  async listForTask(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task not found');
    const [dependencies, dependents] = await Promise.all([
      prisma.taskDependency.findMany({
        where: { taskId },
        include: DEP_INCLUDE,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.taskDependency.findMany({
        where: { dependsOnTaskId: taskId },
        include: DEP_INCLUDE,
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { dependencies, dependents };
  },

  async create(taskId: string, dependsOnTaskId: string, userId?: string) {
    if (taskId === dependsOnTaskId) {
      throw new ValidationError('A task cannot depend on itself');
    }
    const [task, blocker] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.task.findUnique({ where: { id: dependsOnTaskId } }),
    ]);
    if (!task) throw new NotFoundError('Task not found');
    if (!blocker) throw new NotFoundError('Blocking task not found');

    const existing = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    });
    if (existing) throw new ConflictError('Dependency already exists');

    if (await wouldCreateCycle(taskId, dependsOnTaskId)) {
      throw new ValidationError('Adding this dependency would create a cycle');
    }

    const created = await prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId, createdById: userId ?? null },
      include: DEP_INCLUDE,
    });
    await activityService.log({
      entityType: 'task',
      entityId: taskId,
      action: 'dependency_added',
      newValue: { dependsOnTaskId, dependsOnTitle: blocker.title },
      userId: userId ?? null,
    });
    return created;
  },

  async remove(id: string, userId?: string) {
    const dep = await prisma.taskDependency.findUnique({ where: { id } });
    if (!dep) throw new NotFoundError('Dependency not found');
    await prisma.taskDependency.delete({ where: { id } });
    await activityService.log({
      entityType: 'task',
      entityId: dep.taskId,
      action: 'dependency_removed',
      oldValue: { dependsOnTaskId: dep.dependsOnTaskId },
      userId: userId ?? null,
    });
  },

  async isBlocked(taskId: string): Promise<boolean> {
    const blockers = await prisma.taskDependency.findMany({
      where: { taskId },
      include: { dependsOnTask: { select: { status: true } } },
    });
    return blockers.some((b) => OPEN_TASK_STATUSES.has(b.dependsOnTask.status));
  },

  async tasksBlockedByDependencies() {
    const deps = await prisma.taskDependency.findMany({
      include: {
        dependsOnTask: { select: { id: true, title: true, status: true } },
        task: {
          include: {
            project: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });
    const byTask = new Map<
      string,
      { task: (typeof deps)[number]['task']; blockers: { id: string; title: string; status: string }[] }
    >();
    for (const d of deps) {
      if (!OPEN_TASK_STATUSES.has(d.dependsOnTask.status)) continue;
      if (!OPEN_TASK_STATUSES.has(d.task.status)) continue;
      const bucket = byTask.get(d.taskId) ?? { task: d.task, blockers: [] };
      bucket.blockers.push(d.dependsOnTask);
      byTask.set(d.taskId, bucket);
    }
    return Array.from(byTask.values());
  },
};

export { OPEN_TASK_STATUSES };

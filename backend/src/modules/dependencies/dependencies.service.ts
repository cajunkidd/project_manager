import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const DEP_INCLUDE = {
  dependsOn: { select: { id: true, title: true, status: true, projectId: true } },
  task: { select: { id: true, title: true, status: true, projectId: true } },
} as const;

async function ensureNoCycle(taskId: string, dependsOnTaskId: string) {
  // Walk forward from dependsOnTaskId following its own dependencies. If we
  // ever land on taskId, adding the new edge would form a cycle.
  const visited = new Set<string>();
  const stack: string[] = [dependsOnTaskId];
  while (stack.length) {
    const current = stack.pop() as string;
    if (current === taskId) {
      throw new ConflictError('Adding this dependency would create a cycle');
    }
    if (visited.has(current)) continue;
    visited.add(current);
    const next = await prisma.taskDependency.findMany({
      where: { taskId: current },
      select: { dependsOnTaskId: true },
    });
    for (const n of next) stack.push(n.dependsOnTaskId);
  }
}

export const dependenciesService = {
  async listForTask(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
    if (!task) throw new NotFoundError('Task not found');
    const [dependencies, dependents] = await Promise.all([
      prisma.taskDependency.findMany({ where: { taskId }, include: DEP_INCLUDE }),
      prisma.taskDependency.findMany({ where: { dependsOnTaskId: taskId }, include: DEP_INCLUDE }),
    ]);
    return { dependencies, dependents };
  },

  async create(taskId: string, dependsOnTaskId: string, userId?: string) {
    if (taskId === dependsOnTaskId) {
      throw new ValidationError('A task cannot depend on itself');
    }
    const [task, blocker] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId }, select: { id: true } }),
      prisma.task.findUnique({ where: { id: dependsOnTaskId }, select: { id: true } }),
    ]);
    if (!task) throw new NotFoundError('Task not found');
    if (!blocker) throw new NotFoundError('Blocking task not found');

    await ensureNoCycle(taskId, dependsOnTaskId);

    const existing = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    });
    if (existing) throw new ConflictError('Dependency already exists');

    const created = await prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId },
      include: DEP_INCLUDE,
    });
    await activityService.log({
      entityType: 'task',
      entityId: taskId,
      action: 'dependency_added',
      newValue: { dependsOnTaskId },
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

  async listForProject(projectId: string) {
    return prisma.taskDependency.findMany({
      where: { task: { projectId } },
      select: { id: true, taskId: true, dependsOnTaskId: true },
    });
  },

  async unmetBlockers(taskId: string) {
    const deps = await prisma.taskDependency.findMany({
      where: { taskId },
      include: { dependsOn: { select: { id: true, title: true, status: true } } },
    });
    return deps
      .filter((d) => d.dependsOn.status !== 'done')
      .map((d) => d.dependsOn);
  },
};

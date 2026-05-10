import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const TASK_REF = {
  select: { id: true, title: true, status: true, priority: true, dueDate: true },
} as const;

async function wouldCreateCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  // BFS from dependsOnTaskId following its own dependencies; if we reach taskId,
  // the new edge would close a cycle.
  const visited = new Set<string>();
  const queue: string[] = [dependsOnTaskId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const edges = await prisma.taskDependency.findMany({
      where: { taskId: current },
      select: { dependsOnTaskId: true },
    });
    for (const edge of edges) queue.push(edge.dependsOnTaskId);
  }
  return false;
}

export const dependenciesService = {
  async list(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task not found');
    const [dependencies, dependents] = await Promise.all([
      prisma.taskDependency.findMany({
        where: { taskId },
        include: { dependsOnTask: TASK_REF },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.taskDependency.findMany({
        where: { dependsOnTaskId: taskId },
        include: { task: TASK_REF },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const blockingOpen = dependencies.filter((d) => d.dependsOnTask.status !== 'done');
    return {
      dependencies: dependencies.map((d) => ({
        id: d.id,
        createdAt: d.createdAt,
        task: d.dependsOnTask,
      })),
      dependents: dependents.map((d) => ({
        id: d.id,
        createdAt: d.createdAt,
        task: d.task,
      })),
      isBlocked: blockingOpen.length > 0,
    };
  },

  async create(taskId: string, dependsOnTaskId: string, userId?: string) {
    if (taskId === dependsOnTaskId) {
      throw new ValidationError('A task cannot depend on itself');
    }
    const [task, dep] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.task.findUnique({ where: { id: dependsOnTaskId } }),
    ]);
    if (!task) throw new NotFoundError('Task not found');
    if (!dep) throw new NotFoundError('Dependency target not found');

    const existing = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    });
    if (existing) throw new ConflictError('Dependency already exists');

    if (await wouldCreateCycle(taskId, dependsOnTaskId)) {
      throw new ConflictError('Adding this dependency would create a cycle');
    }

    const created = await prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId },
      include: { dependsOnTask: TASK_REF },
    });
    await activityService.log({
      entityType: 'task',
      entityId: taskId,
      action: 'dependency_added',
      newValue: { dependsOnTaskId, title: dep.title },
      userId: userId ?? null,
    });
    return { id: created.id, createdAt: created.createdAt, task: created.dependsOnTask };
  },

  async remove(taskId: string, dependsOnTaskId: string, userId?: string) {
    const existing = await prisma.taskDependency.findUnique({
      where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    });
    if (!existing) throw new NotFoundError('Dependency not found');
    await prisma.taskDependency.delete({ where: { id: existing.id } });
    await activityService.log({
      entityType: 'task',
      entityId: taskId,
      action: 'dependency_removed',
      oldValue: { dependsOnTaskId },
      userId: userId ?? null,
    });
  },
};

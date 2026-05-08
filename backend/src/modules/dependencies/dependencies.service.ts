import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';

const TASK_INCLUDE = {
  select: {
    id: true,
    title: true,
    status: true,
    priority: true,
    dueDate: true,
    completedAt: true,
  },
} as const;

async function pathExists(fromTaskId: string, toTaskId: string): Promise<boolean> {
  // BFS over the dependency graph: does any chain from `fromTaskId` reach `toTaskId`?
  const visited = new Set<string>();
  const queue: string[] = [fromTaskId];
  while (queue.length) {
    const current = queue.shift() as string;
    if (current === toTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = await prisma.taskDependency.findMany({
      where: { taskId: current },
      select: { dependsOnTaskId: true },
    });
    for (const row of next) queue.push(row.dependsOnTaskId);
  }
  return false;
}

export const dependenciesService = {
  async list(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task not found');
    const [dependsOn, blocks] = await Promise.all([
      prisma.taskDependency.findMany({
        where: { taskId },
        include: { dependsOnTask: TASK_INCLUDE },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.taskDependency.findMany({
        where: { dependsOnTaskId: taskId },
        include: { task: TASK_INCLUDE },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { dependsOn, blocks };
  },

  async add(taskId: string, dependsOnTaskId: string) {
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
    if (existing) return existing;

    // Adding A → B is invalid if there's already a path from B to A.
    if (await pathExists(dependsOnTaskId, taskId)) {
      throw new ConflictError('Dependency would create a cycle');
    }

    return prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId },
    });
  },

  async remove(id: string) {
    const existing = await prisma.taskDependency.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Dependency not found');
    await prisma.taskDependency.delete({ where: { id } });
  },
};

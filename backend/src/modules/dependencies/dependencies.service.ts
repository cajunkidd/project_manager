import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';

async function wouldCreateCycle(blockedId: string, blockerId: string): Promise<boolean> {
  // We add blocker -> blocked. A cycle exists if blocked can already reach blocker through the
  // existing blocking graph.
  const visited = new Set<string>();
  const queue: string[] = [blockedId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === blockerId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = await prisma.taskDependency.findMany({
      where: { blockerTaskId: current },
      select: { blockedTaskId: true },
    });
    for (const dep of next) queue.push(dep.blockedTaskId);
  }
  return false;
}

export const dependenciesService = {
  async listForTask(taskId: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task not found');
    const [blockedBy, blocking] = await Promise.all([
      prisma.taskDependency.findMany({
        where: { blockedTaskId: taskId },
        include: {
          blockerTask: { select: { id: true, title: true, status: true } },
        },
      }),
      prisma.taskDependency.findMany({
        where: { blockerTaskId: taskId },
        include: {
          blockedTask: { select: { id: true, title: true, status: true } },
        },
      }),
    ]);
    return { blockedBy, blocking };
  },

  async add(blockedTaskId: string, blockerTaskId: string) {
    if (blockedTaskId === blockerTaskId) {
      throw new ValidationError('A task cannot depend on itself');
    }
    const [a, b] = await Promise.all([
      prisma.task.findUnique({ where: { id: blockedTaskId } }),
      prisma.task.findUnique({ where: { id: blockerTaskId } }),
    ]);
    if (!a || !b) throw new NotFoundError('Task not found');
    if (await wouldCreateCycle(blockedTaskId, blockerTaskId)) {
      throw new ConflictError('Adding this dependency would create a cycle');
    }
    try {
      return await prisma.taskDependency.create({
        data: { blockedTaskId, blockerTaskId },
        include: {
          blockerTask: { select: { id: true, title: true, status: true } },
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictError('Dependency already exists');
      }
      throw err;
    }
  },

  async remove(blockedTaskId: string, blockerTaskId: string) {
    try {
      await prisma.taskDependency.delete({
        where: { blockedTaskId_blockerTaskId: { blockedTaskId, blockerTaskId } },
      });
    } catch {
      throw new NotFoundError('Dependency not found');
    }
  },

  async findOpenBlockers(taskId: string) {
    const rows = await prisma.taskDependency.findMany({
      where: { blockedTaskId: taskId },
      include: { blockerTask: { select: { id: true, title: true, status: true } } },
    });
    return rows
      .map((r) => r.blockerTask)
      .filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  },
};

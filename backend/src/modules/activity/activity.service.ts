import { prisma } from '../../db/prisma';

export interface LogActivityInput {
  entityType: 'project' | 'task' | 'comment';
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  userId?: string | null;
}

export const activityService = {
  async log(input: LogActivityInput) {
    return prisma.activityLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue: input.oldValue !== undefined ? JSON.stringify(input.oldValue) : null,
        newValue: input.newValue !== undefined ? JSON.stringify(input.newValue) : null,
        userId: input.userId ?? null,
      },
    });
  },

  async listForEntity(entityType: string, entityId: string) {
    return prisma.activityLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
  },
};

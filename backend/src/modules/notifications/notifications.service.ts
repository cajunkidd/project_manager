import { prisma } from '../../db/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}

export const notificationsService = {
  async create(input: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
  },

  async listForUser(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return prisma.notification.findMany({
      where: { userId, ...(opts.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });
  },

  async unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  async markRead(id: string, userId: string) {
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Notification not found');
    if (existing.userId !== userId) throw new ForbiddenError();
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  },

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  },
};

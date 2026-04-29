import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
    entityType?: string;
    entityId?: string;
  }) {
    const notification = await this.prisma.notification.create({ data });
    this.emailService
      .sendNotification({
        userId: data.userId,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
      })
      .catch(() => {});
    return notification;
  }

  async findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }
}

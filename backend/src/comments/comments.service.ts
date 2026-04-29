import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activityLogs: ActivityLogsService,
  ) {}

  private extractMentions(body: string): string[] {
    const matches = body.match(/@(\w+)/g) ?? [];
    return matches.map((m) => m.slice(1));
  }

  async getTaskComments(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(data: { taskId?: string; projectId?: string; body: string }, userId: string) {
    const comment = await this.prisma.comment.create({
      data: { ...data, userId },
      include: { user: { select: { id: true, displayName: true } } },
    });

    const entityType = data.taskId ? 'task' : 'project';
    const entityId = data.taskId ?? data.projectId;
    await this.activityLogs.log(entityType, entityId, 'comment_added', null, { body: data.body }, userId);

    const mentionedNames = this.extractMentions(data.body);
    if (mentionedNames.length > 0) {
      const mentionedUsers = await this.prisma.user.findMany({
        where: { displayName: { in: mentionedNames, mode: 'insensitive' } },
        select: { id: true },
      });
      await Promise.all(
        mentionedUsers
          .filter((u) => u.id !== userId)
          .map((u) =>
            this.notifications.create({
              userId: u.id,
              title: 'You were mentioned',
              message: `${comment.user.displayName} mentioned you in a comment`,
              type: 'mention',
              entityType,
              entityId,
            }),
          ),
      );
    }

    return comment;
  }

  async update(id: string, body: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Cannot edit another user\'s comment');
    return this.prisma.comment.update({
      where: { id },
      data: { body },
      include: { user: { select: { id: true, displayName: true } } },
    });
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Cannot delete another user\'s comment');
    return this.prisma.comment.delete({ where: { id } });
  }
}

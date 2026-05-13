import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const MENTION_RE = /@([a-zA-Z0-9._-]+)/g;

async function resolveMentions(body: string, excludeUserId?: string): Promise<string[]> {
  const handles = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) handles.add(match[1]);
  if (!handles.size) return [];

  const handleList = Array.from(handles);
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { displayName: { in: handleList } },
        ...handleList.map((h) => ({ email: { startsWith: `${h}@` } })),
      ],
    },
    select: { id: true },
  });
  return Array.from(new Set(users.map((u) => u.id))).filter((id) => id !== excludeUserId);
}

export interface CreateCommentInput {
  taskId?: string | null;
  projectId?: string | null;
  body: string;
}

const COMMENT_INCLUDE = {
  user: { select: { id: true, displayName: true, email: true } },
} as const;

export const commentsService = {
  async listForTask(taskId: string) {
    return prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: COMMENT_INCLUDE,
    });
  },

  async listForProject(projectId: string) {
    return prisma.comment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: COMMENT_INCLUDE,
    });
  },

  async create(input: CreateCommentInput, userId: string) {
    if (!input.taskId && !input.projectId) {
      throw new ValidationError('Comment must reference a task or a project');
    }
    const comment = await prisma.comment.create({
      data: {
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
        userId,
        body: input.body,
      },
      include: COMMENT_INCLUDE,
    });
    if (input.taskId) {
      await activityService.log({
        entityType: 'task',
        entityId: input.taskId,
        action: 'comment_created',
        newValue: { commentId: comment.id },
        userId,
      });
    }
    if (input.projectId) {
      await activityService.log({
        entityType: 'project',
        entityId: input.projectId,
        action: 'comment_created',
        newValue: { commentId: comment.id },
        userId,
      });
    }

    const mentionedUserIds = await resolveMentions(input.body, userId);
    await eventBus.emit({
      type: 'comment.created',
      taskId: input.taskId ?? null,
      projectId: input.projectId ?? null,
      body: input.body,
      authorId: userId,
      mentionedUserIds,
    });

    return comment;
  },

  async update(id: string, body: string, userId: string) {
    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Comment not found');
    if (existing.userId !== userId) throw new ForbiddenError('Cannot edit another user\'s comment');
    return prisma.comment.update({
      where: { id },
      data: { body },
      include: COMMENT_INCLUDE,
    });
  },

  async remove(id: string, userId: string, role: string) {
    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Comment not found');
    if (existing.userId !== userId && role !== 'admin' && role !== 'master') {
      throw new ForbiddenError('Cannot delete another user\'s comment');
    }
    await prisma.comment.delete({ where: { id } });
  },
};

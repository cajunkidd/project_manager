import { prisma } from '../../db/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';
import { notificationsService } from '../notifications/notifications.service';

const APPROVAL_INCLUDE = {
  task: { select: { id: true, title: true, projectId: true } },
  requestedBy: { select: { id: true, displayName: true, email: true } },
  approver: { select: { id: true, displayName: true, email: true } },
} as const;

export interface RequestApprovalInput {
  approverId: string;
  requestComment?: string | null;
}

export interface DecideApprovalInput {
  status: 'approved' | 'rejected';
  decisionComment?: string | null;
}

export interface ListFilters {
  taskId?: string;
  approverId?: string;
  requestedById?: string;
  status?: string;
}

export const approvalsService = {
  async requestForTask(taskId: string, input: RequestApprovalInput, userId: string) {
    if (input.approverId === userId) {
      throw new ValidationError('Cannot request approval from yourself');
    }
    const [task, approver] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.user.findUnique({ where: { id: input.approverId } }),
    ]);
    if (!task) throw new NotFoundError('Task not found');
    if (!approver) throw new NotFoundError('Approver not found');

    const existing = await prisma.approval.findFirst({
      where: { taskId, approverId: input.approverId, status: 'pending' },
    });
    if (existing) {
      throw new ConflictError('A pending approval from this user already exists');
    }

    const created = await prisma.approval.create({
      data: {
        taskId,
        requestedById: userId,
        approverId: input.approverId,
        requestComment: input.requestComment ?? null,
      },
      include: APPROVAL_INCLUDE,
    });

    await activityService.log({
      entityType: 'task',
      entityId: taskId,
      action: 'approval_requested',
      newValue: { approverId: input.approverId, approvalId: created.id },
      userId,
    });
    await notificationsService.create({
      userId: input.approverId,
      title: 'Approval requested',
      message: `${created.requestedBy.displayName} asked you to review "${task.title}"`,
      type: 'approval_requested',
      entityType: 'task',
      entityId: taskId,
    });

    return created;
  },

  async list(filters: ListFilters = {}) {
    return prisma.approval.findMany({
      where: {
        ...(filters.taskId ? { taskId: filters.taskId } : {}),
        ...(filters.approverId ? { approverId: filters.approverId } : {}),
        ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { requestedAt: 'desc' },
      include: APPROVAL_INCLUDE,
    });
  },

  async getById(id: string) {
    const approval = await prisma.approval.findUnique({
      where: { id },
      include: APPROVAL_INCLUDE,
    });
    if (!approval) throw new NotFoundError('Approval not found');
    return approval;
  },

  async decide(id: string, input: DecideApprovalInput, actor: { id: string; role: string }) {
    const approval = await this.getById(id);
    if (approval.status !== 'pending') {
      throw new ConflictError('Approval has already been decided');
    }
    if (approval.approverId !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenError('Only the designated approver can decide this');
    }

    const updated = await prisma.approval.update({
      where: { id },
      data: {
        status: input.status,
        decisionComment: input.decisionComment ?? null,
        decidedAt: new Date(),
      },
      include: APPROVAL_INCLUDE,
    });

    await activityService.log({
      entityType: 'task',
      entityId: approval.taskId,
      action: `approval_${input.status}`,
      newValue: { approvalId: id, decisionComment: input.decisionComment ?? null },
      userId: actor.id,
    });
    await notificationsService.create({
      userId: approval.requestedById,
      title: input.status === 'approved' ? 'Approval granted' : 'Approval rejected',
      message: `${approval.approver.displayName} ${input.status} your request on "${approval.task.title}"`,
      type: `approval_${input.status}`,
      entityType: 'task',
      entityId: approval.taskId,
    });

    return updated;
  },

  async cancel(id: string, actor: { id: string; role: string }) {
    const approval = await this.getById(id);
    if (approval.status !== 'pending') {
      throw new ConflictError('Only pending approvals can be cancelled');
    }
    if (
      approval.requestedById !== actor.id &&
      actor.role !== 'admin' &&
      actor.role !== 'manager'
    ) {
      throw new ForbiddenError('Only the requester or an admin can cancel this');
    }
    await prisma.approval.delete({ where: { id } });
    await activityService.log({
      entityType: 'task',
      entityId: approval.taskId,
      action: 'approval_cancelled',
      oldValue: { approvalId: id },
      userId: actor.id,
    });
  },
};

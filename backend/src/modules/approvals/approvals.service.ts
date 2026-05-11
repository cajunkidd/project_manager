import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { projectsService } from '../projects/projects.service';
import { tasksService } from '../tasks/tasks.service';

export const APPROVAL_ENTITY_TYPES = ['task', 'project'] as const;
export type ApprovalEntityType = (typeof APPROVAL_ENTITY_TYPES)[number];

const PRIVILEGED_ROLES = new Set(['admin', 'manager']);

const APPROVAL_INCLUDE = {
  requestedBy: { select: { id: true, displayName: true, email: true } },
  approver: { select: { id: true, displayName: true, email: true } },
} as const;

export interface RequestApprovalInput {
  entityType: ApprovalEntityType;
  entityId: string;
  reason?: string | null;
  targetStatus?: string | null;
}

async function verifyEntityExists(type: ApprovalEntityType, id: string): Promise<void> {
  if (type === 'task') {
    const t = await prisma.task.findUnique({ where: { id } });
    if (!t) throw new NotFoundError('Task not found');
  } else {
    const p = await prisma.project.findUnique({ where: { id } });
    if (!p) throw new NotFoundError('Project not found');
  }
}

export const approvalsService = {
  list(filters: { status?: string; entityType?: string; entityId?: string } = {}) {
    return prisma.approvalRequest.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: APPROVAL_INCLUDE,
    });
  },

  async getById(id: string) {
    const r = await prisma.approvalRequest.findUnique({
      where: { id },
      include: APPROVAL_INCLUDE,
    });
    if (!r) throw new NotFoundError('Approval request not found');
    return r;
  },

  async request(input: RequestApprovalInput, userId: string) {
    if (!APPROVAL_ENTITY_TYPES.includes(input.entityType)) {
      throw new ValidationError('Invalid entity type');
    }
    await verifyEntityExists(input.entityType, input.entityId);
    const existing = await prisma.approvalRequest.findFirst({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        status: 'pending',
      },
    });
    if (existing) {
      throw new ConflictError('There is already a pending approval for this item');
    }
    return prisma.approvalRequest.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason ?? null,
        targetStatus: input.targetStatus ?? null,
        requestedById: userId,
      },
      include: APPROVAL_INCLUDE,
    });
  },

  async decide(
    id: string,
    decision: 'approved' | 'rejected',
    approverId: string,
    approverRole: string,
    note?: string | null,
  ) {
    const req = await this.getById(id);
    if (req.status !== 'pending') {
      throw new ConflictError('This request has already been decided');
    }
    if (!PRIVILEGED_ROLES.has(approverRole)) {
      throw new ValidationError('Only managers or admins can decide approvals');
    }
    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: decision,
        approverId,
        decisionAt: new Date(),
        decisionNote: note ?? null,
      },
      include: APPROVAL_INCLUDE,
    });

    if (decision === 'approved' && req.targetStatus) {
      if (req.entityType === 'task') {
        await tasksService.update(req.entityId, { status: req.targetStatus }, approverId);
      } else if (req.entityType === 'project') {
        await projectsService.update(req.entityId, { status: req.targetStatus }, approverId);
      }
    }

    return updated;
  },

  async cancel(id: string, userId: string) {
    const req = await this.getById(id);
    if (req.requestedById !== userId) {
      throw new ValidationError('Only the requester can cancel a request');
    }
    if (req.status !== 'pending') {
      throw new ConflictError('Only pending requests can be cancelled');
    }
    return prisma.approvalRequest.update({
      where: { id },
      data: { status: 'cancelled' },
      include: APPROVAL_INCLUDE,
    });
  },
};

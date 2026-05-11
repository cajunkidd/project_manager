import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 200;

function buildWhere(filters: AuditFilters): Prisma.ActivityLogWhereInput {
  const where: Prisma.ActivityLogWhereInput = {};
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }
  return where;
}

export const auditService = {
  async list(filters: AuditFilters = {}) {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    return prisma.activityLog.findMany({
      where: buildWhere(filters),
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
  },

  async toCsv(filters: AuditFilters = {}): Promise<string> {
    const rows = await this.list({ ...filters, limit: MAX_LIMIT });
    const header = [
      'createdAt',
      'entityType',
      'entityId',
      'action',
      'userId',
      'userDisplayName',
      'userEmail',
      'oldValue',
      'newValue',
    ];
    const lines = [header.join(',')];
    for (const row of rows) {
      const fields = [
        row.createdAt.toISOString(),
        row.entityType,
        row.entityId,
        row.action,
        row.userId ?? '',
        row.user?.displayName ?? '',
        row.user?.email ?? '',
        row.oldValue ?? '',
        row.newValue ?? '',
      ];
      lines.push(fields.map(csvEscape).join(','));
    }
    return `${lines.join('\n')}\n`;
  },
};

function csvEscape(value: string): string {
  // Quote anything containing commas, quotes, or newlines; escape inner quotes.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

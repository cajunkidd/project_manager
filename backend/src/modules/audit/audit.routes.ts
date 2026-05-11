import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { auditService, type AuditFilters } from './audit.service';

function parseFilters(query: Record<string, string | undefined>): AuditFilters {
  return {
    entityType: query.entityType,
    entityId: query.entityId,
    userId: query.userId,
    action: query.action,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
  };
}

export const auditRouter = Router();
auditRouter.use(authMiddleware);
auditRouter.use(requireRole('admin', 'manager'));

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = parseFilters(req.query as Record<string, string>);
    res.json(await auditService.list(filters));
  }),
);

auditRouter.get(
  '/export.csv',
  asyncHandler(async (req, res) => {
    const filters = parseFilters(req.query as Record<string, string>);
    const csv = await auditService.toCsv(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    res.send(csv);
  }),
);

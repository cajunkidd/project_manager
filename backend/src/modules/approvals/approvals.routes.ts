import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
import { APPROVAL_ENTITY_TYPES, approvalsService } from './approvals.service';

const requestSchema = z.object({
  entityType: z.enum(APPROVAL_ENTITY_TYPES),
  entityId: z.string().uuid(),
  reason: z.string().nullable().optional(),
  targetStatus: z.string().nullable().optional(),
});

const decisionSchema = z.object({
  note: z.string().nullable().optional(),
});

export const approvalsRouter = Router();

approvalsRouter.use(authMiddleware);

approvalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, entityType, entityId } = req.query as Record<string, string>;
    res.json(await approvalsService.list({ status, entityType, entityId }));
  }),
);

approvalsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await approvalsService.getById(req.params.id));
  }),
);

approvalsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const data = requestSchema.parse(req.body);
    res.status(201).json(await approvalsService.request(data, req.user.id));
  }),
);

approvalsRouter.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const { note } = decisionSchema.parse(req.body ?? {});
    res.json(
      await approvalsService.decide(req.params.id, 'approved', req.user.id, req.user.role, note),
    );
  }),
);

approvalsRouter.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const { note } = decisionSchema.parse(req.body ?? {});
    res.json(
      await approvalsService.decide(req.params.id, 'rejected', req.user.id, req.user.role, note),
    );
  }),
);

approvalsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await approvalsService.cancel(req.params.id, req.user.id));
  }),
);

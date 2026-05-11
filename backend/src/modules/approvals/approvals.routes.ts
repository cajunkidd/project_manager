import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { UnauthorizedError } from '../../utils/errors';
import { asyncHandler } from '../../utils/asyncHandler';
import { approvalsService } from './approvals.service';

const requestSchema = z.object({
  approverId: z.string().uuid(),
  requestComment: z.string().nullable().optional(),
});

const decisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  decisionComment: z.string().nullable().optional(),
});

export const taskApprovalsRouter = Router({ mergeParams: true });
taskApprovalsRouter.use(authMiddleware);

taskApprovalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await approvalsService.list({ taskId: req.params.id }));
  }),
);

taskApprovalsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const data = requestSchema.parse(req.body);
    res.status(201).json(await approvalsService.requestForTask(req.params.id, data, req.user.id));
  }),
);

export const approvalsRouter = Router();
approvalsRouter.use(authMiddleware);

approvalsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { mine, status, requestedById } = req.query as Record<string, string>;
    res.json(
      await approvalsService.list({
        approverId: mine === 'true' ? req.user?.id : undefined,
        requestedById,
        status,
      }),
    );
  }),
);

approvalsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const data = decisionSchema.parse(req.body);
    res.json(await approvalsService.decide(req.params.id, data, req.user));
  }),
);

approvalsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    await approvalsService.cancel(req.params.id, req.user);
    res.status(204).send();
  }),
);

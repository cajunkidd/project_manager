import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { recurringService } from './recurring.service';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  intervalCount: z.number().int().min(1).max(365).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  hourOfDay: z.number().int().min(0).max(23).optional(),
  dueOffsetDays: z.number().int().min(0).max(365).optional(),
  startAt: isoDate.nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const recurringRouter = Router();
recurringRouter.use(authMiddleware);

recurringRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await recurringService.list());
  }),
);

recurringRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await recurringService.get(req.params.id));
  }),
);

recurringRouter.post(
  '/',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await recurringService.create(data, req.user?.id));
  }),
);

recurringRouter.patch(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await recurringService.update(req.params.id, data));
  }),
);

recurringRouter.delete(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    await recurringService.remove(req.params.id);
    res.status(204).send();
  }),
);

recurringRouter.post(
  '/run-due',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    res.json(await recurringService.runDue(new Date(), req.user?.id));
  }),
);

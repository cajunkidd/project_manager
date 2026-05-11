import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { RECURRING_FREQUENCIES, recurringService } from './recurring.service';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  name: z.string().min(1),
  projectId: z.string().uuid().nullable().optional(),
  templateTitle: z.string().min(1),
  templateDesc: z.string().nullable().optional(),
  templatePriority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  frequency: z.enum(RECURRING_FREQUENCIES),
  nextRunAt: isoDate,
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

export const recurringRouter = Router();

recurringRouter.use(authMiddleware);

recurringRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { projectId, isActive } = req.query as Record<string, string>;
    res.json(
      await recurringService.list({
        projectId,
        isActive: isActive === undefined ? undefined : isActive === 'true',
      }),
    );
  }),
);

recurringRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await recurringService.create(data, req.user?.id));
  }),
);

recurringRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await recurringService.update(req.params.id, data));
  }),
);

recurringRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await recurringService.remove(req.params.id);
    res.status(204).send();
  }),
);

recurringRouter.post(
  '/run-due',
  requireRole('admin', 'manager'),
  asyncHandler(async (_req, res) => {
    res.json(await recurringService.runDue());
  }),
);

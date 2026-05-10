import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { recurringTasksService } from './recurring-tasks.service';

const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  name: z.string().min(1),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  frequency: z.enum(FREQUENCIES),
  interval: z.number().int().positive().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  dueOffsetDays: z.number().int().min(0).optional(),
  startAt: isoDate,
  endAt: isoDate.nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const runDueSchema = z.object({
  now: isoDate.optional(),
});

export const recurringTasksRouter = Router();
recurringTasksRouter.use(authMiddleware);

recurringTasksRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await recurringTasksService.list());
  }),
);

recurringTasksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await recurringTasksService.getById(req.params.id));
  }),
);

recurringTasksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await recurringTasksService.create(data, req.user?.id));
  }),
);

recurringTasksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await recurringTasksService.update(req.params.id, data));
  }),
);

recurringTasksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await recurringTasksService.remove(req.params.id);
    res.status(204).send();
  }),
);

recurringTasksRouter.post(
  '/run-due',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { now } = runDueSchema.parse(req.body ?? {});
    res.json(await recurringTasksService.runDue(now));
  }),
);

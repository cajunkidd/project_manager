import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { tasksService } from './tasks.service';

const TASK_STATUSES = [
  'backlog',
  'to_do',
  'in_progress',
  'waiting',
  'review',
  'done',
  'cancelled',
] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial().extend({
  completedAt: isoDate.nullable().optional(),
});

const statusSchema = z.object({ status: z.enum(TASK_STATUSES) });

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(TASK_STATUSES),
        sortOrder: z.number().int(),
      }),
    )
    .min(1),
});

export const tasksRouter = Router();

tasksRouter.use(authMiddleware);

tasksRouter.patch(
  '/reorder',
  asyncHandler(async (req, res) => {
    const { items } = reorderSchema.parse(req.body);
    res.json(await tasksService.reorder(items, req.user?.id));
  }),
);

tasksRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, assignedToId, priority, projectId, search, dueBefore } = req.query as Record<
      string,
      string
    >;
    res.json(
      await tasksService.list({
        status,
        assignedToId,
        priority,
        projectId,
        search,
        dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      }),
    );
  }),
);

tasksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await tasksService.getById(req.params.id));
  }),
);

tasksRouter.get(
  '/:id/activity',
  asyncHandler(async (req, res) => {
    res.json(await tasksService.listActivity(req.params.id));
  }),
);

tasksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await tasksService.create(data, req.user?.id));
  }),
);

tasksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await tasksService.update(req.params.id, data, req.user?.id));
  }),
);

tasksRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    res.json(await tasksService.updateStatus(req.params.id, status, req.user?.id));
  }),
);

tasksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await tasksService.remove(req.params.id, req.user?.id);
    res.status(204).send();
  }),
);

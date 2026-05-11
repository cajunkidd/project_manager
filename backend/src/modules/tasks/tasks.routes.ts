import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
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

function ctxFromReq(req: { user?: { id: string; role: string } }) {
  if (!req.user) throw new UnauthorizedError();
  return { userId: req.user.id, globalRole: req.user.role };
}

export const tasksRouter = Router();

tasksRouter.use(authMiddleware);

tasksRouter.patch(
  '/reorder',
  asyncHandler(async (req, res) => {
    const { items } = reorderSchema.parse(req.body);
    res.json(await tasksService.reorder(items, req.user?.id, ctxFromReq(req)));
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
      await tasksService.list(
        {
          status,
          assignedToId,
          priority,
          projectId,
          search,
          dueBefore: dueBefore ? new Date(dueBefore) : undefined,
        },
        ctxFromReq(req),
      ),
    );
  }),
);

tasksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await tasksService.getById(req.params.id, ctxFromReq(req)));
  }),
);

tasksRouter.get(
  '/:id/activity',
  asyncHandler(async (req, res) => {
    res.json(await tasksService.listActivity(req.params.id, ctxFromReq(req)));
  }),
);

tasksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await tasksService.create(data, req.user?.id, ctxFromReq(req)));
  }),
);

tasksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await tasksService.update(req.params.id, data, req.user?.id, ctxFromReq(req)));
  }),
);

tasksRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = statusSchema.parse(req.body);
    res.json(await tasksService.updateStatus(req.params.id, status, req.user?.id, ctxFromReq(req)));
  }),
);

tasksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await tasksService.remove(req.params.id, req.user?.id, ctxFromReq(req));
    res.status(204).send();
  }),
);

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
import { projectsService } from './projects.service';

const PROJECT_STATUSES = ['not_started', 'active', 'on_hold', 'completed', 'cancelled'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  department: z.string().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  completedAt: isoDate.nullable().optional(),
});

function ctxFromReq(req: { user?: { id: string; role: string } }) {
  if (!req.user) throw new UnauthorizedError();
  return { userId: req.user.id, globalRole: req.user.role };
}

export const projectsRouter = Router();

projectsRouter.use(authMiddleware);

projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, ownerId, department, priority, search } = req.query as Record<string, string>;
    res.json(
      await projectsService.list(
        { status, ownerId, department, priority, search },
        ctxFromReq(req),
      ),
    );
  }),
);

projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await projectsService.getById(req.params.id, ctxFromReq(req)));
  }),
);

projectsRouter.get(
  '/:id/tasks',
  asyncHandler(async (req, res) => {
    res.json(await projectsService.listTasks(req.params.id, ctxFromReq(req)));
  }),
);

projectsRouter.get(
  '/:id/activity',
  asyncHandler(async (req, res) => {
    res.json(await projectsService.listActivity(req.params.id, ctxFromReq(req)));
  }),
);

projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await projectsService.create(data, req.user?.id));
  }),
);

projectsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await projectsService.update(req.params.id, data, req.user?.id, ctxFromReq(req)));
  }),
);

projectsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await projectsService.remove(req.params.id, req.user?.id, ctxFromReq(req));
    res.status(204).send();
  }),
);

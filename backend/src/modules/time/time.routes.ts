import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
import { timeService } from './time.service';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createTaskTimeSchema = z.object({
  minutes: z.number().int().positive(),
  notes: z.string().nullable().optional(),
  occurredAt: isoDate.optional(),
});

// /api/tasks/:id/time
export const taskTimeRouter = Router({ mergeParams: true });
taskTimeRouter.use(authMiddleware);

taskTimeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const taskId = (req.params as { id: string }).id;
    res.json(await timeService.listForTask(taskId));
  }),
);

taskTimeRouter.get(
  '/rollup',
  asyncHandler(async (req, res) => {
    const taskId = (req.params as { id: string }).id;
    res.json(await timeService.taskRollup(taskId));
  }),
);

taskTimeRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const taskId = (req.params as { id: string }).id;
    const data = createTaskTimeSchema.parse(req.body);
    res.status(201).json(await timeService.create({ taskId, ...data }, req.user.id));
  }),
);

taskTimeRouter.delete(
  '/:entryId',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const entryId = (req.params as { entryId: string }).entryId;
    await timeService.remove(entryId, req.user.id, req.user.role);
    res.status(204).send();
  }),
);

// /api/projects/:id/time
export const projectTimeRouter = Router({ mergeParams: true });
projectTimeRouter.use(authMiddleware);

projectTimeRouter.get(
  '/rollup',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    res.json(await timeService.projectRollup(projectId));
  }),
);

// /api/time/me
export const myTimeRouter = Router();
myTimeRouter.use(authMiddleware);

myTimeRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const { from, to } = req.query as Record<string, string>;
    res.json(
      await timeService.listForUser(
        req.user.id,
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      ),
    );
  }),
);

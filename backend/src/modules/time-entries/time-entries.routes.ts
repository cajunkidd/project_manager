import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
import { timeEntriesService } from './time-entries.service';

const isoDate = z.string().datetime({ offset: true }).transform((v) => new Date(v));

const startSchema = z.object({
  taskId: z.string().uuid(),
  note: z.string().nullable().optional(),
});

const manualSchema = z.object({
  taskId: z.string().uuid(),
  startedAt: isoDate,
  endedAt: isoDate,
  note: z.string().nullable().optional(),
});

const updateSchema = z.object({
  startedAt: isoDate.optional(),
  endedAt: isoDate.nullable().optional(),
  note: z.string().nullable().optional(),
});

export const timeEntriesRouter = Router();
timeEntriesRouter.use(authMiddleware);

timeEntriesRouter.get(
  '/active',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await timeEntriesService.getActive(req.user.id));
  }),
);

timeEntriesRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const { from, to } = req.query as Record<string, string>;
    res.json(
      await timeEntriesService.listForUser(req.user.id, {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      }),
    );
  }),
);

timeEntriesRouter.post(
  '/start',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const { taskId, note } = startSchema.parse(req.body);
    res.status(201).json(await timeEntriesService.start(taskId, req.user.id, note));
  }),
);

timeEntriesRouter.post(
  '/stop',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await timeEntriesService.stop(req.user.id));
  }),
);

timeEntriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const data = manualSchema.parse(req.body);
    res.status(201).json(
      await timeEntriesService.addManual({ ...data, userId: req.user.id }),
    );
  }),
);

timeEntriesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const data = updateSchema.parse(req.body);
    res.json(await timeEntriesService.update(req.params.id, req.user.id, data));
  }),
);

timeEntriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    await timeEntriesService.remove(req.params.id, req.user.id, req.user.role);
    res.status(204).send();
  }),
);

// Mounted at /api/tasks/:id/time-entries
export const taskTimeEntriesRouter = Router({ mergeParams: true });
taskTimeEntriesRouter.use(authMiddleware);

taskTimeEntriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const taskId = (req.params as { id: string }).id;
    const [entries, totalSeconds] = await Promise.all([
      timeEntriesService.listForTask(taskId),
      timeEntriesService.taskTotal(taskId),
    ]);
    res.json({ entries, totalSeconds });
  }),
);

// Mounted at /api/projects/:id/time-summary
export const projectTimeSummaryRouter = Router({ mergeParams: true });
projectTimeSummaryRouter.use(authMiddleware);

projectTimeSummaryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    res.json(await timeEntriesService.projectSummary(projectId));
  }),
);

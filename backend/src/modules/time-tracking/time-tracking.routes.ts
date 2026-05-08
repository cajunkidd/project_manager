import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { timeTrackingService } from './time-tracking.service';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const startSchema = z.object({ note: z.string().max(500).nullable().optional() });

const manualSchema = z.object({
  taskId: z.string().uuid(),
  startedAt: isoDate,
  endedAt: isoDate,
  note: z.string().max(500).nullable().optional(),
});

const updateSchema = z.object({
  startedAt: isoDate.optional(),
  endedAt: isoDate.optional(),
  note: z.string().max(500).nullable().optional(),
});

export const timeEntriesRouter = Router();
export const taskTimeEntriesRouter = Router({ mergeParams: true });

timeEntriesRouter.use(authMiddleware);
taskTimeEntriesRouter.use(authMiddleware);

// Per-task entries

taskTimeEntriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await timeTrackingService.listForTask(req.params.id));
  }),
);

taskTimeEntriesRouter.post(
  '/start',
  asyncHandler(async (req, res) => {
    const { note } = startSchema.parse(req.body ?? {});
    res.status(201).json(
      await timeTrackingService.start(req.params.id, req.user!.id, note ?? null),
    );
  }),
);

// Standalone

timeEntriesRouter.get(
  '/active',
  asyncHandler(async (req, res) => {
    res.json(await timeTrackingService.getActive(req.user!.id));
  }),
);

timeEntriesRouter.post(
  '/stop-active',
  asyncHandler(async (req, res) => {
    res.json(await timeTrackingService.stopActive(req.user!.id));
  }),
);

timeEntriesRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    res.json(await timeTrackingService.listForUser(req.user!.id, { from, to }));
  }),
);

timeEntriesRouter.get(
  '/summary',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const userId = (req.query.userId as string | undefined) ?? undefined;
    res.json(await timeTrackingService.weeklySummary({ date, userId }));
  }),
);

timeEntriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = manualSchema.parse(req.body);
    res.status(201).json(await timeTrackingService.createManual(data, req.user!.id));
  }),
);

timeEntriesRouter.post(
  '/:id/stop',
  asyncHandler(async (req, res) => {
    res.json(await timeTrackingService.stop(req.params.id, req.user!.id));
  }),
);

timeEntriesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await timeTrackingService.update(req.params.id, data, req.user!.id, req.user!.role));
  }),
);

timeEntriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await timeTrackingService.remove(req.params.id, req.user!.id, req.user!.role);
    res.status(204).send();
  }),
);

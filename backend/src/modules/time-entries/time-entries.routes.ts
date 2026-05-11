import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { UnauthorizedError } from '../../utils/errors';
import { asyncHandler } from '../../utils/asyncHandler';
import { timeEntriesService, type SummaryGroupBy } from './time-entries.service';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  minutes: z.number().int().positive(),
  description: z.string().nullable().optional(),
  billable: z.boolean().optional(),
  loggedAt: isoDate.optional(),
});

const updateSchema = createSchema.partial();

const GROUP_BY: SummaryGroupBy[] = ['user', 'project', 'task', 'day'];

export const taskTimeEntriesRouter = Router({ mergeParams: true });
taskTimeEntriesRouter.use(authMiddleware);

taskTimeEntriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await timeEntriesService.list({ taskId: req.params.id }));
  }),
);

taskTimeEntriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const data = createSchema.parse(req.body);
    const created = await timeEntriesService.create(
      { ...data, taskId: req.params.id },
      req.user.id,
    );
    res.status(201).json(created);
  }),
);

export const timeEntriesRouter = Router();
timeEntriesRouter.use(authMiddleware);

timeEntriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { userId, projectId, from, to, mine } = req.query as Record<string, string>;
    const filters = {
      userId: mine === 'true' ? req.user?.id : userId,
      projectId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };
    res.json(await timeEntriesService.list(filters));
  }),
);

timeEntriesRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { groupBy, userId, projectId, from, to, mine } = req.query as Record<string, string>;
    const grouping: SummaryGroupBy = GROUP_BY.includes(groupBy as SummaryGroupBy)
      ? (groupBy as SummaryGroupBy)
      : 'user';
    const filters = {
      userId: mine === 'true' ? req.user?.id : userId,
      projectId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };
    res.json(await timeEntriesService.summary(grouping, filters));
  }),
);

timeEntriesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const data = updateSchema.parse(req.body);
    res.json(await timeEntriesService.update(req.params.id, data, req.user));
  }),
);

timeEntriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    await timeEntriesService.remove(req.params.id, req.user);
    res.status(204).send();
  }),
);

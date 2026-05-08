import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ACTIONS, TRIGGERS, automationsService } from './automations.service';

const conditionSchema = z.object({
  field: z.string().min(1),
  equals: z.unknown().optional(),
  notEquals: z.unknown().optional(),
});

const actionSchema = z.object({
  type: z.enum(ACTIONS),
  params: z.record(z.string(), z.unknown()).default({}),
});

const createSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(TRIGGERS),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

export const automationsRouter = Router();

automationsRouter.use(authMiddleware);
automationsRouter.use(requireRole('admin', 'manager'));

automationsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await automationsService.list());
  }),
);

automationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await automationsService.getById(req.params.id));
  }),
);

automationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await automationsService.create(data, req.user?.id));
  }),
);

automationsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await automationsService.update(req.params.id, data));
  }),
);

automationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await automationsService.remove(req.params.id);
    res.status(204).send();
  }),
);

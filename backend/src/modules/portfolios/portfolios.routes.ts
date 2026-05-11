import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { portfoliosService } from './portfolios.service';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
});

const updateSchema = createSchema.partial();

export const portfoliosRouter = Router();

portfoliosRouter.use(authMiddleware);

portfoliosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await portfoliosService.list());
  }),
);

portfoliosRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await portfoliosService.getById(req.params.id));
  }),
);

portfoliosRouter.get(
  '/:id/rollup',
  asyncHandler(async (req, res) => {
    res.json(await portfoliosService.rollup(req.params.id));
  }),
);

portfoliosRouter.post(
  '/',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await portfoliosService.create(data));
  }),
);

portfoliosRouter.patch(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await portfoliosService.update(req.params.id, data));
  }),
);

portfoliosRouter.delete(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    await portfoliosService.remove(req.params.id);
    res.status(204).send();
  }),
);

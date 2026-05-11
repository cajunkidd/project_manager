import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { portfoliosService } from './portfolios.service';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  projectIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = createSchema.partial();

const projectLinkSchema = z.object({
  projectId: z.string().uuid(),
});

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
  '/:id/summary',
  asyncHandler(async (req, res) => {
    res.json(await portfoliosService.summary(req.params.id));
  }),
);

portfoliosRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await portfoliosService.create(data));
  }),
);

portfoliosRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await portfoliosService.update(req.params.id, data));
  }),
);

portfoliosRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await portfoliosService.remove(req.params.id);
    res.status(204).send();
  }),
);

portfoliosRouter.post(
  '/:id/projects',
  asyncHandler(async (req, res) => {
    const { projectId } = projectLinkSchema.parse(req.body);
    res.status(201).json(await portfoliosService.addProject(req.params.id, projectId));
  }),
);

portfoliosRouter.delete(
  '/:id/projects/:projectId',
  asyncHandler(async (req, res) => {
    await portfoliosService.removeProject(req.params.id, req.params.projectId);
    res.status(204).send();
  }),
);

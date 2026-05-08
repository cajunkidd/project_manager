import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { dependenciesService } from './dependencies.service';

const addSchema = z.object({ dependsOnTaskId: z.string().uuid() });

export const taskDependenciesRouter = Router({ mergeParams: true });
export const dependenciesRouter = Router();

taskDependenciesRouter.use(authMiddleware);
dependenciesRouter.use(authMiddleware);

taskDependenciesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await dependenciesService.list(req.params.id));
  }),
);

taskDependenciesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { dependsOnTaskId } = addSchema.parse(req.body);
    res
      .status(201)
      .json(await dependenciesService.add(req.params.id, dependsOnTaskId));
  }),
);

dependenciesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await dependenciesService.remove(req.params.id);
    res.status(204).send();
  }),
);

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { dependenciesService } from './dependencies.service';

const createSchema = z.object({
  dependsOnTaskId: z.string().uuid(),
});

export const taskDependenciesRouter = Router({ mergeParams: true });
taskDependenciesRouter.use(authMiddleware);

taskDependenciesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await dependenciesService.list(req.params.id));
  }),
);

taskDependenciesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { dependsOnTaskId } = createSchema.parse(req.body);
    res
      .status(201)
      .json(await dependenciesService.create(req.params.id, dependsOnTaskId, req.user?.id));
  }),
);

taskDependenciesRouter.delete(
  '/:dependsOnTaskId',
  asyncHandler(async (req, res) => {
    await dependenciesService.remove(
      req.params.id,
      req.params.dependsOnTaskId,
      req.user?.id,
    );
    res.status(204).send();
  }),
);

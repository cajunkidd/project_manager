import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { dependenciesService } from './dependencies.service';

const createSchema = z.object({
  dependsOnTaskId: z.string().uuid(),
});

// Mounted at /api/tasks/:id/dependencies (mergeParams) and /api/dependencies
export const taskDependenciesRouter = Router({ mergeParams: true });
taskDependenciesRouter.use(authMiddleware);

taskDependenciesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const taskId = (req.params as { id: string }).id;
    res.json(await dependenciesService.listForTask(taskId));
  }),
);

taskDependenciesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const taskId = (req.params as { id: string }).id;
    const { dependsOnTaskId } = createSchema.parse(req.body);
    const created = await dependenciesService.create(taskId, dependsOnTaskId, req.user?.id);
    res.status(201).json(created);
  }),
);

export const dependenciesRouter = Router();
dependenciesRouter.use(authMiddleware);

dependenciesRouter.delete(
  '/:depId',
  asyncHandler(async (req, res) => {
    await dependenciesService.remove(req.params.depId, req.user?.id);
    res.status(204).send();
  }),
);

// Project-scoped listing: /api/projects/:id/dependencies
export const projectDependenciesRouter = Router({ mergeParams: true });
projectDependenciesRouter.use(authMiddleware);
projectDependenciesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    res.json(await dependenciesService.listForProject(projectId));
  }),
);

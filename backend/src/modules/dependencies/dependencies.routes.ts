import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { dependenciesService } from './dependencies.service';

const addSchema = z.object({
  blockerTaskId: z.string().uuid(),
});

// Routes mounted under /api/tasks/:id/dependencies (mergeParams).
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
    const { blockerTaskId } = addSchema.parse(req.body);
    res.status(201).json(await dependenciesService.add(taskId, blockerTaskId));
  }),
);

taskDependenciesRouter.delete(
  '/:blockerTaskId',
  asyncHandler(async (req, res) => {
    const { id: taskId, blockerTaskId } = req.params as { id: string; blockerTaskId: string };
    await dependenciesService.remove(taskId, blockerTaskId);
    res.status(204).send();
  }),
);

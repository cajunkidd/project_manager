import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { commentsService } from './comments.service';

const bodySchema = z.object({ body: z.string().min(1) });

export const commentsRouter = Router();
export const taskCommentsRouter = Router({ mergeParams: true });
export const projectCommentsRouter = Router({ mergeParams: true });

commentsRouter.use(authMiddleware);
taskCommentsRouter.use(authMiddleware);
projectCommentsRouter.use(authMiddleware);

taskCommentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await commentsService.listForTask(req.params.id));
  }),
);

taskCommentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { body } = bodySchema.parse(req.body);
    res.status(201).json(
      await commentsService.create({ taskId: req.params.id, body }, req.user!.id),
    );
  }),
);

projectCommentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await commentsService.listForProject(req.params.id));
  }),
);

projectCommentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { body } = bodySchema.parse(req.body);
    res.status(201).json(
      await commentsService.create({ projectId: req.params.id, body }, req.user!.id),
    );
  }),
);

commentsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { body } = bodySchema.parse(req.body);
    res.json(await commentsService.update(req.params.id, body, req.user!.id));
  }),
);

commentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await commentsService.remove(req.params.id, req.user!.id, req.user!.role);
    res.status(204).send();
  }),
);

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { aiService } from './ai.service';

const extractSchema = z.object({
  text: z.string().min(1).max(20_000),
});

export const aiRouter = Router();
export const projectAiRouter = Router({ mergeParams: true });

aiRouter.use(authMiddleware);
projectAiRouter.use(authMiddleware);

aiRouter.post(
  '/extract-tasks',
  asyncHandler(async (req, res) => {
    const { text } = extractSchema.parse(req.body);
    res.json({ tasks: aiService.extractTasks(text) });
  }),
);

projectAiRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json(await aiService.summarizeProject(req.params.id));
  }),
);

projectAiRouter.get(
  '/risk',
  asyncHandler(async (req, res) => {
    res.json(await aiService.scoreProjectRisk(req.params.id));
  }),
);

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { BUDGET_KINDS, budgetService } from './budget.service';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  kind: z.enum(BUDGET_KINDS),
  amount: z.number(),
  description: z.string().nullable().optional(),
  occurredAt: isoDate.optional(),
});

// Mounted at /api/projects/:id/budget
export const projectBudgetRouter = Router({ mergeParams: true });

projectBudgetRouter.use(authMiddleware);

projectBudgetRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    res.json(await budgetService.list(projectId));
  }),
);

projectBudgetRouter.get(
  '/rollup',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    res.json(await budgetService.rollup(projectId));
  }),
);

projectBudgetRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    const data = createSchema.parse(req.body);
    res.status(201).json(await budgetService.create({ ...data, projectId }, req.user?.id));
  }),
);

projectBudgetRouter.delete(
  '/:entryId',
  asyncHandler(async (req, res) => {
    const entryId = (req.params as { entryId: string }).entryId;
    await budgetService.remove(entryId);
    res.status(204).send();
  }),
);

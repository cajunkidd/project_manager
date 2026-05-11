import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { templatesService } from './templates.service';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const fromProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const rawSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  payload: z.object({
    project: z.object({
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      priority: z.string().optional(),
      department: z.string().nullable().optional(),
      budgetAmount: z.number().nullable().optional(),
      budgetCurrency: z.string().nullable().optional(),
    }),
    tasks: z.array(z.unknown()),
  }),
});

const instantiateSchema = z.object({
  name: z.string().min(1).optional(),
  department: z.string().nullable().optional(),
  startDate: isoDate.nullable().optional(),
});

export const templatesRouter = Router();

templatesRouter.use(authMiddleware);

templatesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await templatesService.list());
  }),
);

templatesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await templatesService.getById(req.params.id));
  }),
);

templatesRouter.post(
  '/from-project',
  asyncHandler(async (req, res) => {
    const data = fromProjectSchema.parse(req.body);
    res
      .status(201)
      .json(
        await templatesService.createFromProject(
          data.projectId,
          data.name,
          data.description ?? null,
          req.user?.id,
        ),
      );
  }),
);

templatesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = rawSchema.parse(req.body);
    res
      .status(201)
      .json(
        await templatesService.createRaw(
          data.name,
          data.description ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.payload as any,
          req.user?.id,
        ),
      );
  }),
);

templatesRouter.post(
  '/:id/instantiate',
  asyncHandler(async (req, res) => {
    const overrides = instantiateSchema.parse(req.body ?? {});
    res
      .status(201)
      .json(await templatesService.instantiate(req.params.id, overrides, req.user?.id));
  }),
);

templatesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await templatesService.remove(req.params.id);
    res.status(204).send();
  }),
);

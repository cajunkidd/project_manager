import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { projectTemplatesService } from './project-templates.service';

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueOffsetDays: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  defaultPriority: z.enum(PRIORITIES).optional(),
  department: z.string().nullable().optional(),
  tasks: z.array(taskSchema).optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const instantiateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  startDate: isoDate.nullable().optional(),
});

export const projectTemplatesRouter = Router();
projectTemplatesRouter.use(authMiddleware);

projectTemplatesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await projectTemplatesService.list());
  }),
);

projectTemplatesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await projectTemplatesService.getById(req.params.id));
  }),
);

projectTemplatesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await projectTemplatesService.create(data, req.user?.id));
  }),
);

projectTemplatesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await projectTemplatesService.update(req.params.id, data));
  }),
);

projectTemplatesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await projectTemplatesService.remove(req.params.id);
    res.status(204).send();
  }),
);

projectTemplatesRouter.post(
  '/:id/instantiate',
  asyncHandler(async (req, res) => {
    const data = instantiateSchema.parse(req.body);
    res
      .status(201)
      .json(await projectTemplatesService.instantiate(req.params.id, data, req.user?.id));
  }),
);

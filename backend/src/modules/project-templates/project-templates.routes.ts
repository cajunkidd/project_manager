import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { projectTemplatesService } from './project-templates.service';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  startOffsetDays: z.number().int().nullable().optional(),
  dueOffsetDays: z.number().int().nullable().optional(),
  parentIndex: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  defaultPriority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  tasks: z.array(taskSchema).optional(),
});

const snapshotSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
});

const instantiateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  department: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  startDate: isoDate,
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
    res.json(await projectTemplatesService.get(req.params.id));
  }),
);

projectTemplatesRouter.post(
  '/',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await projectTemplatesService.create(data, req.user?.id));
  }),
);

projectTemplatesRouter.post(
  '/snapshot',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { projectId, name } = snapshotSchema.parse(req.body);
    res.status(201).json(
      await projectTemplatesService.snapshotFromProject(projectId, name, req.user?.id),
    );
  }),
);

projectTemplatesRouter.post(
  '/:id/instantiate',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = instantiateSchema.parse(req.body);
    res.status(201).json(
      await projectTemplatesService.instantiate(req.params.id, data, req.user?.id),
    );
  }),
);

projectTemplatesRouter.delete(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    await projectTemplatesService.remove(req.params.id);
    res.status(204).send();
  }),
);

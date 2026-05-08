import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { FIELD_TYPES, formsService } from './forms.service';

const fieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  fieldType: z.enum(FIELD_TYPES),
  isRequired: z.boolean().optional(),
  options: z.array(z.string()).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  defaultProjectId: z.string().uuid().nullable().optional(),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
  defaultPriority: z.enum(PRIORITIES).optional(),
  isActive: z.boolean().optional(),
  fields: z.array(fieldSchema).default([]),
});

const updateSchema = createSchema.partial();

const submitSchema = z.object({
  responseData: z.record(z.string(), z.unknown()),
});

export const formsRouter = Router();

formsRouter.use(authMiddleware);

formsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const onlyActive = req.query.active === 'true';
    res.json(await formsService.list({ onlyActive }));
  }),
);

formsRouter.get(
  '/submissions',
  asyncHandler(async (req, res) => {
    const formId = req.query.formId as string | undefined;
    const mine = req.query.mine === 'true';
    res.json(
      await formsService.listSubmissions({
        formId,
        submittedById: mine ? req.user!.id : undefined,
      }),
    );
  }),
);

formsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await formsService.getById(req.params.id));
  }),
);

formsRouter.post(
  '/',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await formsService.create(data, req.user?.id));
  }),
);

formsRouter.patch(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await formsService.update(req.params.id, data));
  }),
);

formsRouter.delete(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    await formsService.remove(req.params.id);
    res.status(204).send();
  }),
);

formsRouter.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const { responseData } = submitSchema.parse(req.body);
    const result = await formsService.submit(
      req.params.id,
      responseData,
      req.user?.id,
    );
    res.status(201).json(result);
  }),
);

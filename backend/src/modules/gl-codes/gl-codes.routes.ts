import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ValidationError } from '../../utils/errors';
import { glCodesService, parseGLCodeCsv, type GLCodeUploadRow } from './gl-codes.service';

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

const uploadRowSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const uploadSchema = z
  .object({
    codes: z.array(uploadRowSchema).optional(),
    csv: z.string().optional(),
  })
  .refine((v) => v.codes !== undefined || v.csv !== undefined, {
    message: 'Provide either a `codes` array or a `csv` string',
  });

export const glCodesRouter = Router();

glCodesRouter.use(authMiddleware);

glCodesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, search, active } = req.query as Record<string, string>;
    res.json(
      await glCodesService.list({
        category,
        search,
        isActive: active === undefined ? undefined : active === 'true',
      }),
    );
  }),
);

glCodesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await glCodesService.getById(req.params.id));
  }),
);

// Writes are restricted to admins and managers (finance owners).
glCodesRouter.use(requireRole('admin', 'manager'));

glCodesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await glCodesService.create(data, req.user?.id));
  }),
);

glCodesRouter.post(
  '/upload',
  asyncHandler(async (req, res) => {
    const { codes, csv } = uploadSchema.parse(req.body);
    let rows: GLCodeUploadRow[];
    if (codes) {
      rows = codes;
    } else {
      rows = parseGLCodeCsv(csv ?? '');
    }
    if (rows.length === 0) throw new ValidationError('No GL codes found in upload');
    res.status(201).json(await glCodesService.upload(rows, req.user?.id));
  }),
);

glCodesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await glCodesService.update(req.params.id, data, req.user?.id));
  }),
);

glCodesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await glCodesService.remove(req.params.id, req.user?.id);
    res.status(204).send();
  }),
);

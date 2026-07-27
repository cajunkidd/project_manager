import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { contractsService } from './contracts.service';

const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated'] as const;

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  contractNumber: z.string().min(1),
  title: z.string().min(1),
  vendor: z.string().nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  status: z.enum(CONTRACT_STATUSES).optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  glCodeId: z.string().uuid().nullable().optional(),
});

const updateSchema = createSchema.partial();

export const contractsRouter = Router();

contractsRouter.use(authMiddleware);

contractsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, glCodeId, vendor, search } = req.query as Record<string, string>;
    res.json(await contractsService.list({ status, glCodeId, vendor, search }));
  }),
);

contractsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await contractsService.getById(req.params.id));
  }),
);

contractsRouter.use(requireRole('admin', 'manager'));

contractsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await contractsService.create(data, req.user?.id));
  }),
);

contractsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await contractsService.update(req.params.id, data, req.user?.id));
  }),
);

contractsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await contractsService.remove(req.params.id, req.user?.id);
    res.status(204).send();
  }),
);

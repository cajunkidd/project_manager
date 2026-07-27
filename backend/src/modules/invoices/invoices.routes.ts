import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { invoicesService } from './invoices.service';

const INVOICE_STATUSES = ['pending', 'approved', 'paid', 'void'] as const;

const isoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
  .transform((v) => new Date(v));

const createSchema = z.object({
  invoiceNumber: z.string().min(1),
  vendor: z.string().nullable().optional(),
  amount: z.number().nonnegative(),
  status: z.enum(INVOICE_STATUSES).optional(),
  issueDate: isoDate.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  glCodeId: z.string().uuid().nullable().optional(),
  contractId: z.string().uuid().nullable().optional(),
});

const updateSchema = createSchema.partial();

export const invoicesRouter = Router();

invoicesRouter.use(authMiddleware);

invoicesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, glCodeId, contractId, vendor, search } = req.query as Record<string, string>;
    res.json(await invoicesService.list({ status, glCodeId, contractId, vendor, search }));
  }),
);

invoicesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await invoicesService.getById(req.params.id));
  }),
);

invoicesRouter.use(requireRole('admin', 'manager'));

invoicesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await invoicesService.create(data, req.user?.id));
  }),
);

invoicesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await invoicesService.update(req.params.id, data, req.user?.id));
  }),
);

invoicesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await invoicesService.remove(req.params.id, req.user?.id);
    res.status(204).send();
  }),
);

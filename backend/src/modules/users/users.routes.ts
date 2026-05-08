import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { usersService } from './users.service';

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(['admin', 'manager', 'user', 'viewer']).optional(),
  department: z.string().nullable().optional(),
});

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(['admin', 'manager', 'user', 'viewer']).optional(),
  department: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const usersRouter = Router();

usersRouter.use(authMiddleware);

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await usersService.list());
  }),
);

usersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await usersService.getById(req.params.id));
  }),
);

usersRouter.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    res.status(201).json(await usersService.create(data));
  }),
);

usersRouter.patch(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await usersService.update(req.params.id, data));
  }),
);

usersRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json(await usersService.deactivate(req.params.id));
  }),
);

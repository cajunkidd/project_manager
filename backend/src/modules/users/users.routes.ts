import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ForbiddenError } from '../../utils/errors';
import { usersService } from './users.service';

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(['master', 'admin', 'manager', 'user', 'viewer']).optional(),
  department: z.string().nullable().optional(),
});

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(['master', 'admin', 'manager', 'user', 'viewer']).optional(),
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
    if (data.role === 'master' && req.user!.role !== 'master') {
      throw new ForbiddenError('Only the master account may grant the master role');
    }
    res.status(201).json(await usersService.create(data));
  }),
);

usersRouter.patch(
  '/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const actor = req.user!;
    const target = await usersService.getById(req.params.id);

    // Only the master account may touch a master user, grant the master role,
    // or change another user's role at all (managers can edit profile fields
    // but not roles).
    if (target.role === 'master' && actor.role !== 'master') {
      throw new ForbiddenError('Only the master account may modify a master account');
    }
    if (data.role !== undefined && data.role !== target.role) {
      if (actor.role !== 'master' && actor.role !== 'admin') {
        throw new ForbiddenError('Only master or admin accounts may change user roles');
      }
      if (data.role === 'master' && actor.role !== 'master') {
        throw new ForbiddenError('Only the master account may grant the master role');
      }
    }

    res.json(await usersService.update(req.params.id, data));
  }),
);

usersRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const actor = req.user!;
    const target = await usersService.getById(req.params.id);
    if (target.role === 'master' && actor.role !== 'master') {
      throw new ForbiddenError('Only the master account may deactivate a master account');
    }
    res.json(await usersService.deactivate(req.params.id));
  }),
);

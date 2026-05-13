import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, signToken } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
import { promoteIfMasterEmail } from '../users/bootstrap-master';
import { usersService } from '../users/users.service';

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(8),
  department: z.string().nullable().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const user = await usersService.create({ ...data, role: 'user' });
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ user, token });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await usersService.findByEmailWithPassword(email);
    if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');
    const ok = await usersService.verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Invalid credentials');

    // Self-heal: if this is the configured master email but the account
    // pre-dates the master rollout, promote on login so the freshly issued
    // token reflects the elevated role.
    const role = await promoteIfMasterEmail(user.id, user.email, user.role);

    const token = signToken({ id: user.id, email: user.email, role });
    const { passwordHash: _omit, ...safe } = user;
    res.json({ user: { ...safe, role }, token });
  }),
);

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const fresh = await usersService.getById(req.user!.id);
    const role = await promoteIfMasterEmail(fresh.id, fresh.email, fresh.role);
    res.json({ ...fresh, role });
  }),
);

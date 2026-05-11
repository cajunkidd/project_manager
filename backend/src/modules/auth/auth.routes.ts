import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, signToken } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError } from '../../utils/errors';
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
    // First user on a fresh install becomes the admin so the app is usable
    // immediately after the launcher boots.
    const isFirstUser = (await usersService.count()) === 0;
    const user = await usersService.create({
      ...data,
      role: isFirstUser ? 'admin' : 'user',
    });
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

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    const { passwordHash: _omit, ...safe } = user;
    res.json({ user: safe, token });
  }),
);

authRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json(await usersService.getById(req.user!.id));
  }),
);

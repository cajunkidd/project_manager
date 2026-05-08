import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { emailService } from './email.service';

const inboundSchema = z.object({
  from: z.string().email(),
  to: z.string().email().optional(),
  subject: z.string().min(1),
  body: z.string().default(''),
});

const digestSchema = z.object({
  userId: z.string().uuid(),
});

export const emailRouter = Router();

emailRouter.use(authMiddleware);

emailRouter.post(
  '/inbound',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = inboundSchema.parse(req.body);
    const result = await emailService.ingest(data);
    res.status(201).json(result);
  }),
);

emailRouter.post(
  '/digest',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { userId } = digestSchema.parse(req.body);
    res.json(await emailService.dailyDigestForUser(userId));
  }),
);

emailRouter.get(
  '/log',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const { prisma } = await import('../../db/prisma');
    res.json(
      await prisma.emailLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }),
);

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { WEBHOOK_EVENTS, webhooksService } from './webhooks.service';

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

export const webhooksRouter = Router();

webhooksRouter.use(authMiddleware);
webhooksRouter.use(requireRole('admin'));

webhooksRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const subs = await webhooksService.list();
    res.json(
      subs.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        events: s.events.split(',').filter(Boolean),
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        deliveryCount: s._count.deliveries,
      })),
    );
  }),
);

webhooksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sub = await webhooksService.getById(req.params.id);
    res.json({
      id: sub.id,
      name: sub.name,
      url: sub.url,
      events: sub.events.split(',').filter(Boolean),
      isActive: sub.isActive,
      secret: sub.secret,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    });
  }),
);

webhooksRouter.get(
  '/:id/deliveries',
  asyncHandler(async (req, res) => {
    res.json(await webhooksService.listDeliveries(req.params.id));
  }),
);

webhooksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const created = await webhooksService.create(data, req.user?.id);
    res.status(201).json(created);
  }),
);

webhooksRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    res.json(await webhooksService.update(req.params.id, data));
  }),
);

webhooksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await webhooksService.remove(req.params.id);
    res.status(204).send();
  }),
);

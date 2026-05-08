import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { notificationsService } from './notifications.service';

export const notificationsRouter = Router();

notificationsRouter.use(authMiddleware);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unreadOnly === 'true';
    res.json(await notificationsService.listForUser(req.user!.id, { unreadOnly }));
  }),
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    res.json({ count: await notificationsService.unreadCount(req.user!.id) });
  }),
);

notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.markAllRead(req.user!.id));
  }),
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    res.json(await notificationsService.markRead(req.params.id, req.user!.id));
  }),
);

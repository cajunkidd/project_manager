import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { dashboardService } from './dashboard.service';

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);

dashboardRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await dashboardService.forUser(req.user!.id));
  }),
);

dashboardRouter.get(
  '/manager',
  requireRole('admin', 'manager'),
  asyncHandler(async (_req, res) => {
    res.json(await dashboardService.forManager());
  }),
);

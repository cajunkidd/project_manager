import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { workloadService } from './workload.service';

export const workloadRouter = Router();
workloadRouter.use(authMiddleware);
workloadRouter.use(requireRole('admin', 'manager'));

workloadRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const department = (req.query.department as string | undefined) || undefined;
    const projectId = (req.query.projectId as string | undefined) || undefined;
    res.json(await workloadService.list({ department, projectId }));
  }),
);

import { Router } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { reportsService, type ReportFilters } from './reports.service';

function parseFilters(query: Record<string, string | undefined>): ReportFilters {
  const filters: ReportFilters = {};
  if (query.from) filters.from = new Date(query.from);
  if (query.to) filters.to = new Date(query.to);
  if (query.department) filters.department = query.department;
  if (query.projectId) filters.projectId = query.projectId;
  if (query.userId) filters.userId = query.userId;
  if (query.priority) filters.priority = query.priority;
  return filters;
}

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);
reportsRouter.use(requireRole('admin', 'manager'));

reportsRouter.get(
  '/tasks-by-user',
  asyncHandler(async (req, res) => {
    res.json(await reportsService.openTasksByUser(parseFilters(req.query as Record<string, string>)));
  }),
);

reportsRouter.get(
  '/overdue',
  asyncHandler(async (req, res) => {
    res.json(await reportsService.overdueTasks(parseFilters(req.query as Record<string, string>)));
  }),
);

reportsRouter.get(
  '/projects-by-status',
  asyncHandler(async (req, res) => {
    res.json(
      await reportsService.projectsByStatus(parseFilters(req.query as Record<string, string>)),
    );
  }),
);

reportsRouter.get(
  '/completion-by-week',
  asyncHandler(async (req, res) => {
    res.json(
      await reportsService.tasksCompletedByWeek(parseFilters(req.query as Record<string, string>)),
    );
  }),
);

reportsRouter.get(
  '/avg-completion',
  asyncHandler(async (req, res) => {
    res.json(
      await reportsService.averageCompletionTime(parseFilters(req.query as Record<string, string>)),
    );
  }),
);

reportsRouter.get(
  '/blocked',
  asyncHandler(async (req, res) => {
    res.json(await reportsService.blockedTasks(parseFilters(req.query as Record<string, string>)));
  }),
);

reportsRouter.get(
  '/blocked-by-deps',
  asyncHandler(async (req, res) => {
    res.json(
      await reportsService.tasksBlockedByDependencies(
        parseFilters(req.query as Record<string, string>),
      ),
    );
  }),
);

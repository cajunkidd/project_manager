import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import { aiRouter, projectAiRouter } from './modules/ai/ai.routes';
import { apiTokensRouter } from './modules/api-tokens/api-tokens.routes';
import { publicApiRouter } from './modules/api-tokens/public.routes';
import { automationsRouter } from './modules/automations/automations.routes';
import { registerAutomationEngine } from './modules/automations/automations.engine';
import { authRouter } from './modules/auth/auth.routes';
import {
  commentsRouter,
  projectCommentsRouter,
  taskCommentsRouter,
} from './modules/comments/comments.routes';
import { approvalsRouter } from './modules/approvals/approvals.routes';
import { projectBudgetRouter } from './modules/budget/budget.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { taskDependenciesRouter } from './modules/dependencies/dependencies.routes';
import { emailRouter } from './modules/email/email.routes';
import { registerEmailListeners } from './modules/email/email.listeners';
import { formsRouter } from './modules/forms/forms.routes';
import { projectMembersRouter } from './modules/members/members.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { registerNotificationListeners } from './modules/notifications/notifications.listeners';
import { portfoliosRouter } from './modules/portfolios/portfolios.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { realtimeRouter } from './modules/realtime/realtime.routes';
import { registerRealtimeListeners } from './modules/realtime/realtime.listeners';
import { recurringRouter } from './modules/recurring/recurring.routes';
import { startRecurringScheduler } from './modules/recurring/recurring.service';
import { reportsRouter } from './modules/reports/reports.routes';
import { templatesRouter } from './modules/templates/templates.routes';
import {
  myTimeRouter,
  projectTimeRouter,
  taskTimeRouter,
} from './modules/time/time.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { usersRouter } from './modules/users/users.routes';
import { webhooksRouter } from './modules/webhooks/webhooks.routes';
import { registerWebhookDispatcher } from './modules/webhooks/webhooks.dispatcher';
import { workloadRouter } from './modules/workload/workload.routes';

export function createApp() {
  registerNotificationListeners();
  registerAutomationEngine();
  registerEmailListeners();
  registerWebhookDispatcher();
  registerRealtimeListeners();
  startRecurringScheduler();

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Internal (JWT-authenticated) API
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:id/members', projectMembersRouter);
  app.use('/api/projects/:id/comments', projectCommentsRouter);
  app.use('/api/projects/:id/budget', projectBudgetRouter);
  app.use('/api/projects/:id/time', projectTimeRouter);
  app.use('/api/realtime', realtimeRouter);
  app.use('/api/portfolios', portfoliosRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/recurring', recurringRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/tasks/:id/dependencies', taskDependenciesRouter);
  app.use('/api/tasks/:id/time', taskTimeRouter);
  app.use('/api/time', myTimeRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/tasks/:id/comments', taskCommentsRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/forms', formsRouter);
  app.use('/api/automations', automationsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/workload', workloadRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/projects/:id/ai', projectAiRouter);
  app.use('/api/email', emailRouter);
  app.use('/api/api-tokens', apiTokensRouter);
  app.use('/api/webhooks', webhooksRouter);

  // Public (token-authenticated) API
  app.use('/api/v1', publicApiRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}

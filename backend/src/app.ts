import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import { aiRouter, projectAiRouter } from './modules/ai/ai.routes';
import { apiTokensRouter } from './modules/api-tokens/api-tokens.routes';
import { publicApiRouter } from './modules/api-tokens/public.routes';
import {
  attachmentsRouter,
  projectAttachmentsRouter,
  taskAttachmentsRouter,
} from './modules/attachments/attachments.routes';
import { automationsRouter } from './modules/automations/automations.routes';
import { registerAutomationEngine } from './modules/automations/automations.engine';
import { authRouter } from './modules/auth/auth.routes';
import {
  commentsRouter,
  projectCommentsRouter,
  taskCommentsRouter,
} from './modules/comments/comments.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { taskDependenciesRouter } from './modules/dependencies/dependencies.routes';
import { emailRouter } from './modules/email/email.routes';
import { registerEmailListeners } from './modules/email/email.listeners';
import { formsRouter } from './modules/forms/forms.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { registerNotificationListeners } from './modules/notifications/notifications.listeners';
import { projectsRouter } from './modules/projects/projects.routes';
import { projectTemplatesRouter } from './modules/project-templates/project-templates.routes';
import { recurringTasksRouter } from './modules/recurring-tasks/recurring-tasks.routes';
import { reportsRouter } from './modules/reports/reports.routes';
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

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Internal (JWT-authenticated) API
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:id/comments', projectCommentsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/tasks/:id/comments', taskCommentsRouter);
  app.use('/api/tasks/:id/attachments', taskAttachmentsRouter);
  app.use('/api/tasks/:id/dependencies', taskDependenciesRouter);
  app.use('/api/projects/:id/attachments', projectAttachmentsRouter);
  app.use('/api/attachments', attachmentsRouter);
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
  app.use('/api/recurring-tasks', recurringTasksRouter);
  app.use('/api/project-templates', projectTemplatesRouter);

  // Public (token-authenticated) API
  app.use('/api/v1', publicApiRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}

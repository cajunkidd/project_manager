import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler';
import { automationsRouter } from './modules/automations/automations.routes';
import { registerAutomationEngine } from './modules/automations/automations.engine';
import { authRouter } from './modules/auth/auth.routes';
import {
  commentsRouter,
  projectCommentsRouter,
  taskCommentsRouter,
} from './modules/comments/comments.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { formsRouter } from './modules/forms/forms.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { registerNotificationListeners } from './modules/notifications/notifications.listeners';
import { projectsRouter } from './modules/projects/projects.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';
import { usersRouter } from './modules/users/users.routes';
import { workloadRouter } from './modules/workload/workload.routes';

export function createApp() {
  registerNotificationListeners();
  registerAutomationEngine();

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:id/comments', projectCommentsRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/tasks/:id/comments', taskCommentsRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/forms', formsRouter);
  app.use('/api/automations', automationsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/workload', workloadRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}

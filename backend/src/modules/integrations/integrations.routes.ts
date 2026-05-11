import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { tokenAuth } from '../api-tokens/api-token.middleware';
import { tasksService } from '../tasks/tasks.service';
import {
  ENTITY_TYPES,
  EXTERNAL_SYSTEM_KINDS,
  externalLinksService,
  externalSystemsService,
} from './external-systems.service';
import { mondayService } from './monday.service';
import { outlookService } from './outlook.service';

const systemConfigSchema = z.record(z.unknown());

const createSystemSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(EXTERNAL_SYSTEM_KINDS),
  config: systemConfigSchema.default({}),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const updateSystemSchema = createSystemSchema.partial();

const createLinkSchema = z.object({
  systemId: z.string().uuid().nullable().optional(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().uuid(),
  externalId: z.string().nullable().optional(),
  url: z.string().url().nullable().optional(),
  label: z.string().nullable().optional(),
});

const mondayImportSchema = z.object({
  boards: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        items: z.array(z.any()).optional(),
        items_page: z.object({ items: z.array(z.any()).optional() }).optional(),
      }),
    )
    .optional(),
  items: z.array(z.any()).optional(),
});

const intranetIntakeSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  requesterEmail: z.string().email().optional(),
  externalId: z.string().min(1).optional(),
  externalUrl: z.string().url().optional(),
  systemId: z.string().uuid().optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  projectId: z.string().uuid().nullable().optional(),
});

export const integrationsRouter = Router();
export const calendarFeedRouter = Router();

integrationsRouter.use(authMiddleware);

// --- External systems CRUD (admin) ---
integrationsRouter.get(
  '/systems',
  requireRole('admin', 'manager'),
  asyncHandler(async (_req, res) => {
    res.json(await externalSystemsService.list());
  }),
);

integrationsRouter.post(
  '/systems',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = createSystemSchema.parse(req.body);
    res.status(201).json(await externalSystemsService.create(data, req.user?.id));
  }),
);

integrationsRouter.patch(
  '/systems/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = updateSystemSchema.parse(req.body);
    res.json(await externalSystemsService.update(req.params.id, data));
  }),
);

integrationsRouter.delete(
  '/systems/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await externalSystemsService.remove(req.params.id);
    res.status(204).send();
  }),
);

// --- External links (per task/project) ---
integrationsRouter.get(
  '/links/:entityType/:entityId',
  asyncHandler(async (req, res) => {
    const entityType = req.params.entityType;
    if (!ENTITY_TYPES.includes(entityType as 'task' | 'project')) {
      return res.status(400).json({ error: 'Unknown entityType' });
    }
    return res.json(
      await externalLinksService.listFor(entityType as 'task' | 'project', req.params.entityId),
    );
  }),
);

integrationsRouter.post(
  '/links',
  asyncHandler(async (req, res) => {
    const data = createLinkSchema.parse(req.body);
    res.status(201).json(await externalLinksService.create(data));
  }),
);

integrationsRouter.delete(
  '/links/:id',
  asyncHandler(async (req, res) => {
    await externalLinksService.remove(req.params.id);
    res.status(204).send();
  }),
);

// --- Monday.com import ---
integrationsRouter.post(
  '/monday/import',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = mondayImportSchema.parse(req.body);
    const result = await mondayService.import(data, req.user?.id);
    res.status(201).json(result);
  }),
);

integrationsRouter.get(
  '/monday/jobs',
  requireRole('admin', 'manager'),
  asyncHandler(async (_req, res) => {
    res.json(await mondayService.listJobs());
  }),
);

// --- Outlook calendar token (per user) ---
integrationsRouter.get(
  '/outlook/me/calendar-url',
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Auth required' });
    const token = outlookService.tokenFor(user.id);
    const host = `${req.protocol}://${req.get('host')}`;
    return res.json({
      url: `${host}/api/integrations/outlook/calendar/${user.id}.ics?token=${token}`,
      token,
    });
  }),
);

// --- Intranet portal intake (token-auth, public-ish) ---
export const intranetIntakeRouter = Router();
intranetIntakeRouter.post(
  '/intake',
  tokenAuth('tasks:write'),
  asyncHandler(async (req, res) => {
    const data = intranetIntakeSchema.parse(req.body);
    const task = await tasksService.create({
      projectId: data.projectId ?? null,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? 'normal',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    });
    if (data.externalId || data.externalUrl || data.systemId) {
      await externalLinksService.create({
        systemId: data.systemId ?? null,
        entityType: 'task',
        entityId: task.id,
        externalId: data.externalId ?? null,
        url: data.externalUrl ?? null,
        label: 'Intranet request',
      });
    }
    res.status(201).json(task);
  }),
);

// --- Public calendar feed (token in query string, no auth header) ---
calendarFeedRouter.get(
  '/outlook/calendar/:userId.ics',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? '');
    if (!token) return res.status(401).type('text/plain').send('Missing token');
    try {
      await outlookService.resolveUser(req.params.userId, token);
    } catch {
      return res.status(401).type('text/plain').send('Invalid token');
    }
    const body = await outlookService.buildCalendar(req.params.userId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="project-manager.ics"');
    return res.send(body);
  }),
);

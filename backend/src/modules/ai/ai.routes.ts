import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { aiService } from './ai.service';

const extractSchema = z.object({
  text: z.string().min(1).max(20_000),
});

const meetingNotesSchema = z.object({
  text: z.string().min(1).max(50_000),
  projectId: z.string().uuid().optional(),
});

const emailMessageSchema = z.object({
  from: z.string().min(1),
  to: z.array(z.string()).optional(),
  subject: z.string().optional(),
  body: z.string().default(''),
  sentAt: z.string().datetime().optional(),
});

const emailThreadSchema = z.object({
  thread: z.array(emailMessageSchema).min(1).max(100),
});

const execSummaryQuery = z.object({
  since: z.string().datetime().optional(),
});

const suggestionsQuery = z.object({
  projectId: z.string().uuid().optional(),
  threshold: z.coerce.number().min(0).max(1).optional(),
});

export const aiRouter = Router();
export const projectAiRouter = Router({ mergeParams: true });

aiRouter.use(authMiddleware);
projectAiRouter.use(authMiddleware);

aiRouter.post(
  '/extract-tasks',
  asyncHandler(async (req, res) => {
    const { text } = extractSchema.parse(req.body);
    res.json({ tasks: aiService.extractTasks(text) });
  }),
);

aiRouter.get(
  '/exec-summary',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { since } = execSummaryQuery.parse(req.query);
    res.json(await aiService.execSummary({ since: since ? new Date(since) : undefined }));
  }),
);

aiRouter.get(
  '/prioritize',
  asyncHandler(async (req, res) => {
    const { projectId } = suggestionsQuery.parse(req.query);
    res.json(await aiService.prioritize(projectId));
  }),
);

aiRouter.get(
  '/cleanup',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { projectId } = suggestionsQuery.parse(req.query);
    res.json(await aiService.cleanup(projectId));
  }),
);

aiRouter.get(
  '/duplicates',
  asyncHandler(async (req, res) => {
    const { projectId, threshold } = suggestionsQuery.parse(req.query);
    res.json(await aiService.duplicates(projectId, threshold ?? 0.6));
  }),
);

aiRouter.post(
  '/meeting-notes',
  asyncHandler(async (req, res) => {
    const { text } = meetingNotesSchema.parse(req.body);
    res.json(aiService.parseMeetingNotes(text));
  }),
);

aiRouter.post(
  '/summarize-email',
  asyncHandler(async (req, res) => {
    const { thread } = emailThreadSchema.parse(req.body);
    res.json(aiService.summarizeEmail(thread));
  }),
);

projectAiRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json(await aiService.summarizeProject(req.params.id));
  }),
);

projectAiRouter.get(
  '/risk',
  asyncHandler(async (req, res) => {
    res.json(await aiService.scoreProjectRisk(req.params.id));
  }),
);

projectAiRouter.get(
  '/prioritize',
  asyncHandler(async (req, res) => {
    res.json(await aiService.prioritize(req.params.id));
  }),
);

projectAiRouter.get(
  '/cleanup',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    res.json(await aiService.cleanup(req.params.id));
  }),
);

projectAiRouter.get(
  '/duplicates',
  asyncHandler(async (req, res) => {
    const { threshold } = suggestionsQuery.parse(req.query);
    res.json(await aiService.duplicates(req.params.id, threshold ?? 0.6));
  }),
);

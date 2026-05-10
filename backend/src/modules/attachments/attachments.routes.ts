import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { attachmentsService } from './attachments.service';

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(127).nullable().optional(),
  data: z.string().min(1), // base64
});

export const taskAttachmentsRouter = Router({ mergeParams: true });
taskAttachmentsRouter.use(authMiddleware);

taskAttachmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const taskId = (req.params as { id: string }).id;
    res.json(await attachmentsService.listForTask(taskId));
  }),
);

taskAttachmentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const taskId = (req.params as { id: string }).id;
    const body = uploadSchema.parse(req.body);
    const created = await attachmentsService.create(
      { ...body, taskId },
      req.user?.id,
    );
    res.status(201).json(created);
  }),
);

export const projectAttachmentsRouter = Router({ mergeParams: true });
projectAttachmentsRouter.use(authMiddleware);

projectAttachmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    res.json(await attachmentsService.listForProject(projectId));
  }),
);

projectAttachmentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const projectId = (req.params as { id: string }).id;
    const body = uploadSchema.parse(req.body);
    const created = await attachmentsService.create(
      { ...body, projectId },
      req.user?.id,
    );
    res.status(201).json(created);
  }),
);

export const attachmentsRouter = Router();
attachmentsRouter.use(authMiddleware);

attachmentsRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const att = await attachmentsService.getDownload(req.params.id);
    const buf = Buffer.from(att.data, 'base64');
    res.setHeader('Content-Type', att.mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${att.fileName.replace(/"/g, '')}"`,
    );
    res.setHeader('Content-Length', buf.length.toString());
    res.send(buf);
  }),
);

attachmentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await attachmentsService.remove(req.params.id, req.user?.id);
    res.status(204).send();
  }),
);

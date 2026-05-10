import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { attachmentsService } from './attachments.service';

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  content: z.string().min(1),
});

export const taskAttachmentsRouter = Router({ mergeParams: true });
taskAttachmentsRouter.use(authMiddleware);

taskAttachmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await attachmentsService.listForTask(req.params.id));
  }),
);

taskAttachmentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = uploadSchema.parse(req.body);
    res.status(201).json(await attachmentsService.uploadToTask(req.params.id, data, req.user?.id));
  }),
);

export const projectAttachmentsRouter = Router({ mergeParams: true });
projectAttachmentsRouter.use(authMiddleware);

projectAttachmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await attachmentsService.listForProject(req.params.id));
  }),
);

projectAttachmentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = uploadSchema.parse(req.body);
    res
      .status(201)
      .json(await attachmentsService.uploadToProject(req.params.id, data, req.user?.id));
  }),
);

export const attachmentsRouter = Router();
attachmentsRouter.use(authMiddleware);

attachmentsRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const file = await attachmentsService.download(req.params.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    );
    res.setHeader('Content-Length', String(file.fileSize));
    res.send(file.buffer);
  }),
);

attachmentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await attachmentsService.remove(req.params.id, req.user?.id);
    res.status(204).send();
  }),
);

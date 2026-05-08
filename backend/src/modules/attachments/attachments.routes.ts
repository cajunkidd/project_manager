import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ValidationError } from '../../utils/errors';
import { MAX_FILE_BYTES, attachmentsService } from './attachments.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

export const attachmentsRouter = Router();
export const taskAttachmentsRouter = Router({ mergeParams: true });
export const projectAttachmentsRouter = Router({ mergeParams: true });

attachmentsRouter.use(authMiddleware);
taskAttachmentsRouter.use(authMiddleware);
projectAttachmentsRouter.use(authMiddleware);

taskAttachmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await attachmentsService.listForTask(req.params.id));
  }),
);

taskAttachmentsRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) throw new ValidationError('Missing file (form field "file")');
    res.status(201).json(
      await attachmentsService.create({
        taskId: req.params.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
        uploadedById: req.user!.id,
      }),
    );
  }),
);

projectAttachmentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await attachmentsService.listForProject(req.params.id));
  }),
);

projectAttachmentsRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) throw new ValidationError('Missing file (form field "file")');
    res.status(201).json(
      await attachmentsService.create({
        projectId: req.params.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
        uploadedById: req.user!.id,
      }),
    );
  }),
);

attachmentsRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const { record, fullPath } = await attachmentsService.getByIdForDownload(req.params.id);
    res.setHeader('Content-Type', record.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${record.fileName.replace(/"/g, '_')}"`,
    );
    res.sendFile(fullPath);
  }),
);

attachmentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await attachmentsService.remove(req.params.id, req.user!.id, req.user!.role);
    res.status(204).send();
  }),
);

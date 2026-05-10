import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export interface UploadInput {
  fileName: string;
  mimeType: string;
  content: string; // base64
}

const META_SELECT = {
  id: true,
  taskId: true,
  projectId: true,
  uploadedById: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedBy: { select: { id: true, displayName: true, email: true } },
} as const;

function decodeAndValidate(input: UploadInput): { buffer: Buffer; fileSize: number } {
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new ValidationError(`Unsupported mime type: ${input.mimeType}`);
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.content, 'base64');
  } catch {
    throw new ValidationError('Invalid base64 content');
  }
  if (buffer.length === 0) {
    throw new ValidationError('Empty file payload');
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new ValidationError(`File exceeds ${MAX_FILE_SIZE} byte limit`);
  }
  return { buffer, fileSize: buffer.length };
}

export const attachmentsService = {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,

  async uploadToTask(taskId: string, input: UploadInput, userId?: string) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task not found');
    const { buffer, fileSize } = decodeAndValidate(input);
    const created = await prisma.attachment.create({
      data: {
        taskId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize,
        content: buffer.toString('base64'),
        uploadedById: userId ?? null,
      },
      select: META_SELECT,
    });
    await activityService.log({
      entityType: 'task',
      entityId: taskId,
      action: 'attachment_added',
      newValue: { fileName: input.fileName, fileSize },
      userId: userId ?? null,
    });
    return created;
  },

  async uploadToProject(projectId: string, input: UploadInput, userId?: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');
    const { buffer, fileSize } = decodeAndValidate(input);
    const created = await prisma.attachment.create({
      data: {
        projectId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize,
        content: buffer.toString('base64'),
        uploadedById: userId ?? null,
      },
      select: META_SELECT,
    });
    await activityService.log({
      entityType: 'project',
      entityId: projectId,
      action: 'attachment_added',
      newValue: { fileName: input.fileName, fileSize },
      userId: userId ?? null,
    });
    return created;
  },

  async listForTask(taskId: string) {
    return prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: META_SELECT,
    });
  },

  async listForProject(projectId: string) {
    return prisma.attachment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: META_SELECT,
    });
  },

  async download(id: string) {
    const att = await prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundError('Attachment not found');
    return {
      fileName: att.fileName,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      buffer: Buffer.from(att.content, 'base64'),
    };
  },

  async remove(id: string, userId?: string) {
    const att = await prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundError('Attachment not found');
    await prisma.attachment.delete({ where: { id } });
    if (att.taskId) {
      await activityService.log({
        entityType: 'task',
        entityId: att.taskId,
        action: 'attachment_removed',
        oldValue: { fileName: att.fileName },
        userId: userId ?? null,
      });
    } else if (att.projectId) {
      await activityService.log({
        entityType: 'project',
        entityId: att.projectId,
        action: 'attachment_removed',
        oldValue: { fileName: att.fileName },
        userId: userId ?? null,
      });
    }
  },
};

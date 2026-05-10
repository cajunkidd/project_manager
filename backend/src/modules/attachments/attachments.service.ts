import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap for the local-storage profile

const ALLOWED_PREFIXES = [
  'image/',
  'text/',
  'application/pdf',
  'application/json',
  'application/zip',
  'application/octet-stream',
];

function isAllowedMime(mime: string | undefined | null): boolean {
  if (!mime) return true;
  return ALLOWED_PREFIXES.some((p) => mime.startsWith(p) || mime === p);
}

const SUMMARY = {
  id: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  taskId: true,
  projectId: true,
  uploadedById: true,
  createdAt: true,
} as const;

const SUMMARY_INCLUDE = {
  uploadedBy: { select: { id: true, displayName: true, email: true } },
} as const;

export interface CreateAttachmentInput {
  taskId?: string | null;
  projectId?: string | null;
  fileName: string;
  mimeType?: string | null;
  data: string; // base64 (without data: prefix)
}

export const attachmentsService = {
  async create(input: CreateAttachmentInput, userId?: string) {
    if (!input.taskId && !input.projectId) {
      throw new ValidationError('Attachment requires a taskId or projectId');
    }
    if (!isAllowedMime(input.mimeType ?? null)) {
      throw new ValidationError('Unsupported file type');
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(input.data, 'base64');
    } catch {
      throw new ValidationError('Attachment data must be base64-encoded');
    }
    if (buf.length === 0) throw new ValidationError('Empty file');
    if (buf.length > MAX_BYTES) throw new ValidationError('File exceeds 5 MB limit');

    if (input.taskId) {
      const task = await prisma.task.findUnique({ where: { id: input.taskId }, select: { id: true } });
      if (!task) throw new NotFoundError('Task not found');
    }
    if (input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true },
      });
      if (!project) throw new NotFoundError('Project not found');
    }

    const created = await prisma.attachment.create({
      data: {
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
        fileName: input.fileName,
        mimeType: input.mimeType ?? null,
        fileSize: buf.length,
        data: input.data,
        uploadedById: userId ?? null,
      },
      select: { ...SUMMARY, ...SUMMARY_INCLUDE },
    });

    await activityService.log({
      entityType: input.taskId ? 'task' : 'project',
      entityId: (input.taskId ?? input.projectId) as string,
      action: 'attachment_added',
      newValue: { fileName: created.fileName, fileSize: created.fileSize },
      userId: userId ?? null,
    });

    return created;
  },

  async listForTask(taskId: string) {
    return prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      select: { ...SUMMARY, ...SUMMARY_INCLUDE },
    });
  },

  async listForProject(projectId: string) {
    return prisma.attachment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { ...SUMMARY, ...SUMMARY_INCLUDE },
    });
  },

  async getDownload(id: string) {
    const att = await prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundError('Attachment not found');
    return att;
  },

  async remove(id: string, userId?: string) {
    const att = await prisma.attachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundError('Attachment not found');
    await prisma.attachment.delete({ where: { id } });
    await activityService.log({
      entityType: att.taskId ? 'task' : 'project',
      entityId: (att.taskId ?? att.projectId) as string,
      action: 'attachment_removed',
      oldValue: { fileName: att.fileName },
      userId: userId ?? null,
    });
  },
};

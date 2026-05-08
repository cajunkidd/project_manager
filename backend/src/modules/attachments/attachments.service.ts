import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '../../db/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';

const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_ROOT ?? path.join(process.cwd(), 'uploads'),
);

export const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES ?? 25 * 1024 * 1024);
export const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/zip',
  'application/json',
  'text/',
  'application/vnd.openxmlformats-officedocument',
  'application/msword',
  'application/vnd.ms-excel',
];

function safeStoredName(originalName: string): string {
  const ext = path.extname(originalName).slice(0, 24);
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}-${base}${ext}`;
}

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export interface CreateAttachmentInput {
  taskId?: string | null;
  projectId?: string | null;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  uploadedById?: string | null;
}

const ATTACHMENT_INCLUDE = {
  uploadedBy: { select: { id: true, displayName: true, email: true } },
} as const;

async function ensureUploadRoot(): Promise<void> {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
}

export const attachmentsService = {
  uploadRoot: UPLOAD_ROOT,

  async create(input: CreateAttachmentInput) {
    if (!input.taskId && !input.projectId) {
      throw new ValidationError('Attachment must reference a task or a project');
    }
    if (input.buffer.byteLength === 0) {
      throw new ValidationError('Empty file');
    }
    if (input.buffer.byteLength > MAX_FILE_BYTES) {
      throw new ValidationError(`File exceeds ${MAX_FILE_BYTES} bytes`);
    }
    if (!isAllowedMime(input.mimeType)) {
      throw new ValidationError(`Disallowed MIME type: ${input.mimeType}`);
    }

    await ensureUploadRoot();
    const stored = safeStoredName(input.fileName);
    const fullPath = path.join(UPLOAD_ROOT, stored);
    await fs.writeFile(fullPath, input.buffer);

    return prisma.attachment.create({
      data: {
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
        uploadedById: input.uploadedById ?? null,
        fileName: input.fileName,
        storedPath: stored,
        mimeType: input.mimeType,
        fileSize: input.buffer.byteLength,
      },
      include: ATTACHMENT_INCLUDE,
    });
  },

  async listForTask(taskId: string) {
    return prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: ATTACHMENT_INCLUDE,
    });
  },

  async listForProject(projectId: string) {
    return prisma.attachment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: ATTACHMENT_INCLUDE,
    });
  },

  async getByIdForDownload(id: string) {
    const record = await prisma.attachment.findUnique({ where: { id } });
    if (!record) throw new NotFoundError('Attachment not found');
    const fullPath = path.resolve(UPLOAD_ROOT, record.storedPath);
    if (!fullPath.startsWith(UPLOAD_ROOT)) {
      throw new ForbiddenError('Invalid file path');
    }
    return { record, fullPath };
  },

  async remove(id: string, userId: string, role: string) {
    const record = await prisma.attachment.findUnique({ where: { id } });
    if (!record) throw new NotFoundError('Attachment not found');
    if (record.uploadedById !== userId && role !== 'admin' && role !== 'manager') {
      throw new ForbiddenError('Cannot delete this attachment');
    }
    const fullPath = path.resolve(UPLOAD_ROOT, record.storedPath);
    if (fullPath.startsWith(UPLOAD_ROOT)) {
      await fs.unlink(fullPath).catch(() => undefined);
    }
    await prisma.attachment.delete({ where: { id } });
  },
};

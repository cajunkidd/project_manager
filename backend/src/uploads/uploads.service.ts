import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadsService {
  constructor(private prisma: PrismaService) {}

  async saveAttachment(
    file: Express.Multer.File,
    opts: { taskId?: string; projectId?: string; uploadedById: string },
  ) {
    const relativePath = `/uploads/${file.filename}`;
    return this.prisma.attachment.create({
      data: {
        taskId: opts.taskId ?? null,
        projectId: opts.projectId ?? null,
        uploadedById: opts.uploadedById,
        fileName: file.originalname,
        fileUrl: relativePath,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
      include: { uploadedBy: { select: { id: true, displayName: true } } },
    });
  }

  async getForTask(taskId: string) {
    return this.prisma.attachment.findMany({
      where: { taskId },
      include: { uploadedBy: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForProject(projectId: string) {
    return this.prisma.attachment.findMany({
      where: { projectId },
      include: { uploadedBy: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const absolutePath = path.join(process.cwd(), attachment.fileUrl);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    return this.prisma.attachment.delete({ where: { id } });
  }
}

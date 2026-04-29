import {
  Controller, Post, Delete, Get, Param, Query,
  UseGuards, Request, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const storage = diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowed = [
    'image/', 'application/pdf', 'text/', 'application/json',
    'application/msword', 'application/vnd.',
    'application/zip', 'application/x-zip',
  ];
  if (allowed.some((t) => file.mimetype.startsWith(t))) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

@UseGuards(JwtAuthGuard)
@Controller()
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('tasks/:taskId/attachments')
  @UseInterceptors(FileInterceptor('file', { storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadToTask(
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) return { error: 'No file or unsupported type.' };
    return this.uploadsService.saveAttachment(file, { taskId, uploadedById: req.user.id });
  }

  @Post('projects/:projectId/attachments')
  @UseInterceptors(FileInterceptor('file', { storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadToProject(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) return { error: 'No file or unsupported type.' };
    return this.uploadsService.saveAttachment(file, { projectId, uploadedById: req.user.id });
  }

  @Get('tasks/:taskId/attachments')
  getForTask(@Param('taskId') taskId: string) {
    return this.uploadsService.getForTask(taskId);
  }

  @Get('projects/:projectId/attachments')
  getForProject(@Param('projectId') projectId: string) {
    return this.uploadsService.getForProject(projectId);
  }

  @Delete('attachments/:id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.uploadsService.delete(id, req.user.id);
  }
}

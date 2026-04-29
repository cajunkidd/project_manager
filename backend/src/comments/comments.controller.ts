import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get('tasks/:taskId/comments')
  getTaskComments(@Param('taskId') taskId: string) {
    return this.commentsService.getTaskComments(taskId);
  }

  @Post('tasks/:taskId/comments')
  addTaskComment(@Param('taskId') taskId: string, @Body('body') body: string, @Request() req: any) {
    return this.commentsService.addComment({ taskId, body }, req.user.id);
  }

  @Post('projects/:projectId/comments')
  addProjectComment(@Param('projectId') projectId: string, @Body('body') body: string, @Request() req: any) {
    return this.commentsService.addComment({ projectId, body }, req.user.id);
  }

  @Patch('comments/:id')
  update(@Param('id') id: string, @Body('body') body: string, @Request() req: any) {
    return this.commentsService.update(id, body, req.user.id);
  }

  @Delete('comments/:id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.commentsService.remove(id, req.user.id);
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class TimeEntriesController {
  constructor(private timeEntriesService: TimeEntriesService) {}

  @Get('tasks/:taskId/time')
  getForTask(@Param('taskId') taskId: string) {
    return this.timeEntriesService.getForTask(taskId);
  }

  @Post('tasks/:taskId/time')
  create(
    @Param('taskId') taskId: string,
    @Body() body: { minutes: number; notes?: string; loggedAt?: string },
    @Request() req: any,
  ) {
    return this.timeEntriesService.create({ ...body, taskId }, req.user.id);
  }

  @Get('time-entries/my')
  myEntries(@Query() query: { from?: string; to?: string }, @Request() req: any) {
    return this.timeEntriesService.getUserEntries(req.user.id, query);
  }

  @Get('time-entries/report')
  report(@Query() query: { userId?: string; from?: string; to?: string }) {
    return this.timeEntriesService.reportByProject(query);
  }

  @Patch('time-entries/:id')
  update(
    @Param('id') id: string,
    @Body() body: { minutes?: number; notes?: string; loggedAt?: string },
    @Request() req: any,
  ) {
    return this.timeEntriesService.update(id, body, req.user.id);
  }

  @Delete('time-entries/:id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.timeEntriesService.delete(id);
  }
}

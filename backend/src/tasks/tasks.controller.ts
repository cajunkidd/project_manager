import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.tasksService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.tasksService.create(body, req.user.id);
  }

  @Patch('reorder')
  reorder(@Body() body: { tasks: { id: string; sortOrder: number }[] }) {
    return this.tasksService.reorder(body.tasks);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.tasksService.update(id, body, req.user.id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @Request() req: any) {
    return this.tasksService.updateStatus(id, status, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.tasksService.remove(id, req.user.id);
  }

  @Get(':id/dependencies')
  getDependencies(@Param('id') id: string) {
    return this.tasksService.getDependencies(id);
  }

  @Post(':id/dependencies')
  addDependency(@Param('id') id: string, @Body('dependsOnTaskId') dependsOnTaskId: string) {
    return this.tasksService.addDependency(id, dependsOnTaskId);
  }

  @Delete(':id/dependencies/:depId')
  removeDependency(@Param('depId') depId: string) {
    return this.tasksService.removeDependency(depId);
  }
}

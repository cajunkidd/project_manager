import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('tasks-by-user')
  tasksByUser(@Query() query: { department?: string; projectId?: string }) {
    return this.reportsService.tasksByUser(query);
  }

  @Get('overdue')
  overdue(@Query() query: { department?: string; projectId?: string; userId?: string }) {
    return this.reportsService.overdueTasks(query);
  }

  @Get('projects-by-status')
  projectsByStatus(@Query() query: { department?: string }) {
    return this.reportsService.projectsByStatus(query);
  }

  @Get('completion-trend')
  completionTrend(@Query('weeks') weeks?: string) {
    return this.reportsService.completionTrend(weeks ? parseInt(weeks) : 8);
  }

  @Get('blocked')
  blocked(@Query() query: { projectId?: string; userId?: string }) {
    return this.reportsService.blockedTasks(query);
  }

  @Get('avg-completion')
  avgCompletion(@Query() query: { projectId?: string; userId?: string }) {
    return this.reportsService.avgCompletionTime(query);
  }

  @Get('workload')
  workload(@Query() query: { department?: string }) {
    return this.reportsService.workload(query);
  }
}

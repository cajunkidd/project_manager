import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('me')
  getUserDashboard(@Request() req: any) {
    return this.dashboardService.getUserDashboard(req.user.id);
  }

  @Get('manager')
  getManagerDashboard() {
    return this.dashboardService.getManagerDashboard();
  }
}

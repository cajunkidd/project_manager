import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationEngine } from './automation-engine.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automations')
export class AutomationsController {
  constructor(
    private automationsService: AutomationsService,
    private engine: AutomationEngine,
  ) {}

  @Get()
  findAll() {
    return this.automationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.automationsService.findById(id);
  }

  @Roles('admin', 'manager')
  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.automationsService.create(body, req.user.id);
  }

  @Roles('admin', 'manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.automationsService.update(id, body);
  }

  @Roles('admin', 'manager')
  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.automationsService.toggle(id);
  }

  @Roles('admin', 'manager')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.automationsService.remove(id);
  }

  @Roles('admin', 'manager')
  @Post('run-overdue-check')
  runOverdueCheck() {
    return this.engine.runOverdueCheck();
  }
}

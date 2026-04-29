import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FormsService } from './forms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormsController {
  constructor(private formsService: FormsService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    return this.formsService.findAll(active === 'true');
  }

  @Get('submissions')
  getSubmissions(@Query() query: { formId?: string; userId?: string }, @Request() req: any) {
    const isManager = ['admin', 'manager'].includes(req.user.role);
    return this.formsService.getSubmissions({
      ...query,
      ...(!isManager && { userId: req.user.id }),
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.formsService.findById(id);
  }

  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.formsService.create(body, req.user.id);
  }

  @Roles('admin', 'manager')
  @UseGuards(RolesGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.formsService.update(id, body);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() body: Record<string, any>, @Request() req: any) {
    return this.formsService.submit(id, body, req.user.id);
  }
}

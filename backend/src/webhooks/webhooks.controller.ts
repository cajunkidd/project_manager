import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Get()
  list() {
    return this.webhooksService.list();
  }

  @Post()
  create(@Body() body: { name: string; url: string; events: string[] }, @Request() req: any) {
    return this.webhooksService.create(body, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.webhooksService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }

  @Get(':id/deliveries')
  deliveries(@Param('id') id: string) {
    return this.webhooksService.listDeliveries(id);
  }

  @Post('deliveries/:id/redeliver')
  async redeliver(@Param('id') id: string) {
    await this.webhooksService.redeliver(id);
    return { ok: true };
  }
}

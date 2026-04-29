import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTokensService } from './api-tokens.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api-tokens')
export class ApiTokensController {
  constructor(private apiTokensService: ApiTokensService) {}

  @Get()
  list(@Request() req: any) {
    return this.apiTokensService.list(req.user.id, req.user.role === 'admin');
  }

  @Post()
  create(@Body() body: { name: string; scopes?: string[]; expiresAt?: string | null }, @Request() req: any) {
    return this.apiTokensService.create(body, req.user.id);
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @Request() req: any) {
    return this.apiTokensService.revoke(id, req.user.id, req.user.role === 'admin');
  }
}

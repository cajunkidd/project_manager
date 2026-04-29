import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('status')
  status() {
    return { available: this.aiService.isAvailable() };
  }

  @Post('parse-task')
  parseTask(@Body('text') text: string) {
    return this.aiService.parseTask(text);
  }

  @Post('enhance')
  enhance(@Body() body: { title: string; description: string }) {
    return this.aiService.enhanceDescription(body.title, body.description).then((text) => ({ text }));
  }

  @Post('project-summary/:id')
  projectSummary(@Param('id') id: string) {
    return this.aiService.projectSummary(id).then((summary) => ({ summary }));
  }

  @Post('suggest-priority')
  suggestPriority(@Body() body: { title: string; description: string }) {
    return this.aiService.suggestPriority(body.title, body.description);
  }
}

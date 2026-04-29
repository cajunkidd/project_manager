import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [ActivityLogsModule, WebhooksModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}

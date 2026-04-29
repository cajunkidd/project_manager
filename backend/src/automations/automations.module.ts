import { Module, forwardRef } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { AutomationEngine } from './automation-engine.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [NotificationsModule, ActivityLogsModule],
  providers: [AutomationsService, AutomationEngine],
  controllers: [AutomationsController],
  exports: [AutomationEngine, AutomationsService],
})
export class AutomationsModule {}

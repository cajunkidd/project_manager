import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { EmailModule } from '../email/email.module';
import { AutomationsModule } from '../automations/automations.module';

@Module({
  imports: [ScheduleModule.forRoot(), EmailModule, AutomationsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}

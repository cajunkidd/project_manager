import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { FormsModule } from './forms/forms.module';
import { AutomationsModule } from './automations/automations.module';
import { UploadsModule } from './uploads/uploads.module';
import { AiModule } from './ai/ai.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { EmailModule } from './email/email.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    PrismaModule,
    ApiTokensModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    ActivityLogsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,
    FormsModule,
    AutomationsModule,
    UploadsModule,
    AiModule,
    TimeEntriesModule,
    WebhooksModule,
    EmailModule,
    SchedulerModule,
  ],
})
export class AppModule {}

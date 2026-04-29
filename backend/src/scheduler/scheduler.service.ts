import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';
import { AutomationEngine } from '../automations/automation-engine.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private emailService: EmailService,
    private automationEngine: AutomationEngine,
  ) {}

  @Cron(process.env.DIGEST_CRON ?? '0 8 * * *', { name: 'daily-digest', timeZone: process.env.TZ })
  async dailyDigest() {
    if (!this.emailService.isAvailable()) return;
    try {
      const result = await this.emailService.sendDigestToAll();
      this.logger.log(`Daily digest: sent=${result.sent}, skipped=${result.skipped}`);
    } catch (e: any) {
      this.logger.warn(`Daily digest failed: ${e.message}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'overdue-check' })
  async hourlyOverdueCheck() {
    try {
      const result = await this.automationEngine.runOverdueCheck();
      this.logger.log(`Overdue check: ${JSON.stringify(result)}`);
    } catch (e: any) {
      this.logger.warn(`Overdue check failed: ${e.message}`);
    }
  }
}

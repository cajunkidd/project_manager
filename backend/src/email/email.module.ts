import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { InboundEmailService } from './inbound.service';
import { EmailController } from './email.controller';

@Module({
  providers: [EmailService, InboundEmailService],
  controllers: [EmailController],
  exports: [EmailService],
})
export class EmailModule {}

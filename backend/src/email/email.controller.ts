import { Body, Controller, ForbiddenException, Get, Headers, Post, UseGuards, Request } from '@nestjs/common';
import { EmailService } from './email.service';
import { InboundEmailService } from './inbound.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('email')
export class EmailController {
  constructor(
    private emailService: EmailService,
    private inboundEmailService: InboundEmailService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  status() {
    return { available: this.emailService.isAvailable() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('digest/me')
  myDigest(@Request() req: any) {
    return this.emailService
      .sendDailyDigest(req.user.id)
      .then((sent) => ({ sent }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('digest/all')
  digestAll() {
    return this.emailService.sendDigestToAll();
  }

  @Post('inbound')
  inbound(
    @Headers('x-inbound-secret') secret: string,
    @Body() body: any,
  ) {
    const expected = process.env.INBOUND_EMAIL_SECRET;
    if (!expected || secret !== expected) throw new ForbiddenException('Invalid inbound secret');
    return this.inboundEmailService.ingest(body);
  }
}

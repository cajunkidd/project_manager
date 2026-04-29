import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailController {
  constructor(private emailService: EmailService) {}

  @Get('status')
  status() {
    return { available: this.emailService.isAvailable() };
  }

  @Post('digest/me')
  myDigest(@Request() req: any) {
    return this.emailService
      .sendDailyDigest(req.user.id)
      .then((sent) => ({ sent }));
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('digest/all')
  digestAll() {
    return this.emailService.sendDigestToAll();
  }
}

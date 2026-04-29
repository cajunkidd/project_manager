import { Controller, Post, Body, UseGuards, Get, Patch, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(@Request() req, @Body() body: { emailNotifications?: boolean; emailDigest?: boolean; displayName?: string; department?: string }) {
    const { emailNotifications, emailDigest, displayName, department } = body;
    return this.usersService.update(req.user.id, { emailNotifications, emailDigest, displayName, department });
  }
}

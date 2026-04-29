import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTokensService, TOKEN_PREFIX } from '../api-tokens/api-tokens.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private apiTokensService: ApiTokensService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth: string | undefined = req.headers.authorization;

    if (auth?.startsWith('Bearer ' + TOKEN_PREFIX)) {
      const raw = auth.slice('Bearer '.length);
      const result = await this.apiTokensService.validate(raw);
      if (!result) throw new UnauthorizedException('Invalid API token');
      const user = await this.prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, email: true, role: true, isActive: true },
      });
      if (!user || !user.isActive) throw new UnauthorizedException('Token owner inactive');
      req.user = { id: user.id, email: user.email, role: user.role, scopes: result.scopes };
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }
}

import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const TOKEN_PREFIX = 'pmat_';

@Injectable()
export class ApiTokensService {
  constructor(private prisma: PrismaService) {}

  private hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async create(
    data: { name: string; scopes?: string[]; expiresAt?: string | null },
    userId: string,
  ): Promise<{ id: string; token: string; prefix: string; name: string; scopes: string[] }> {
    const raw = TOKEN_PREFIX + crypto.randomBytes(24).toString('base64url');
    const tokenHash = this.hash(raw);
    const prefix = raw.slice(0, 12);

    const record = await this.prisma.apiToken.create({
      data: {
        name: data.name,
        tokenHash,
        prefix,
        scopes: data.scopes ?? [],
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdById: userId,
      },
    });

    return { id: record.id, token: raw, prefix, name: record.name, scopes: record.scopes };
  }

  async list(userId: string, isAdmin: boolean) {
    return this.prisma.apiToken.findMany({
      where: isAdmin ? {} : { createdById: userId },
      select: {
        id: true, name: true, prefix: true, scopes: true,
        lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true,
        createdBy: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, userId: string, isAdmin: boolean) {
    const token = await this.prisma.apiToken.findUnique({ where: { id } });
    if (!token) throw new NotFoundException('Token not found');
    if (!isAdmin && token.createdById !== userId) throw new UnauthorizedException();
    return this.prisma.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async validate(raw: string): Promise<{ userId: string; scopes: string[] } | null> {
    if (!raw.startsWith(TOKEN_PREFIX)) return null;
    const tokenHash = this.hash(raw);
    const record = await this.prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { createdBy: { select: { id: true, isActive: true } } },
    });
    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;
    if (!record.createdBy?.isActive) return null;

    this.prisma.apiToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return { userId: record.createdById, scopes: record.scopes };
  }
}

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '../../db/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export const TOKEN_PREFIX = 'pm_';

export interface CreateTokenInput {
  name: string;
  scopes: string[];
}

function generateToken(): { token: string; prefix: string } {
  const random = crypto.randomBytes(24).toString('base64url');
  const token = `${TOKEN_PREFIX}${random}`;
  return { token, prefix: token.slice(0, 8) };
}

export const apiTokensService = {
  async list() {
    return prisma.apiToken.findMany({
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, displayName: true, email: true } } },
    });
  },

  async create(input: CreateTokenInput, userId?: string) {
    const { token, prefix } = generateToken();
    const tokenHash = await bcrypt.hash(token, 10);
    const record = await prisma.apiToken.create({
      data: {
        name: input.name,
        tokenHash,
        prefix,
        scopes: input.scopes.join(','),
        createdById: userId ?? null,
      },
    });
    return { token, record };
  },

  async revoke(id: string) {
    const existing = await prisma.apiToken.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Token not found');
    return prisma.apiToken.update({ where: { id }, data: { isActive: false } });
  },

  async verify(token: string) {
    if (!token.startsWith(TOKEN_PREFIX)) throw new ForbiddenError('Invalid token');
    const candidates = await prisma.apiToken.findMany({
      where: { isActive: true, prefix: token.slice(0, 8) },
      take: 5,
    });
    for (const candidate of candidates) {
      if (await bcrypt.compare(token, candidate.tokenHash)) {
        await prisma.apiToken.update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        });
        return candidate;
      }
    }
    throw new ForbiddenError('Invalid token');
  },

  hasScope(record: { scopes: string }, scope: string): boolean {
    return record.scopes
      .split(',')
      .map((s) => s.trim())
      .includes(scope);
  },
};

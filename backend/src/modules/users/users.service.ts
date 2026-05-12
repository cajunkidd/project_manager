import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isBootstrapAdmin(email: string): boolean {
  return env.bootstrapAdminEmails.includes(normalizeEmail(email));
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  password: string;
  role?: string;
  department?: string | null;
}

export interface UpdateUserInput {
  displayName?: string;
  role?: string;
  department?: string | null;
  isActive?: boolean;
}

const SAFE_FIELDS = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  department: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const usersService = {
  async list() {
    return prisma.user.findMany({
      select: SAFE_FIELDS,
      orderBy: { displayName: 'asc' },
    });
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: SAFE_FIELDS,
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  },

  async findByEmailWithPassword(email: string) {
    return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  },

  async create(input: CreateUserInput) {
    const email = normalizeEmail(input.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const role = isBootstrapAdmin(email) ? 'admin' : input.role ?? 'user';
    return prisma.user.create({
      data: {
        email,
        displayName: input.displayName,
        passwordHash,
        role,
        department: input.department ?? null,
      },
      select: SAFE_FIELDS,
    });
  },

  /**
   * Promote any users whose email appears in BOOTSTRAP_ADMIN_EMAILS to admin.
   * Run at server startup so the list is enforced after each boot.
   * Email comparison is case-insensitive — we lowercase any rows that aren't
   * already lowercased before matching.
   */
  async syncBootstrapAdmins(): Promise<{ promoted: string[] }> {
    if (env.bootstrapAdminEmails.length === 0) return { promoted: [] };

    const candidates = await prisma.user.findMany({
      where: { email: { in: env.bootstrapAdminEmails } },
      select: { id: true, email: true, role: true },
    });
    // Also catch rows whose email differs only in case (legacy data).
    const allUsers = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
    const caseMatches = allUsers.filter(
      (u) =>
        env.bootstrapAdminEmails.includes(u.email.toLowerCase()) &&
        !candidates.some((c) => c.id === u.id),
    );

    const promoted: string[] = [];
    for (const u of [...candidates, ...caseMatches]) {
      if (u.role !== 'admin') {
        await prisma.user.update({ where: { id: u.id }, data: { role: 'admin' } });
        promoted.push(u.email);
      }
    }
    return { promoted };
  },

  async update(id: string, input: UpdateUserInput) {
    await this.getById(id);
    return prisma.user.update({
      where: { id },
      data: input,
      select: SAFE_FIELDS,
    });
  },

  async deactivate(id: string) {
    await this.getById(id);
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: SAFE_FIELDS,
    });
  },

  async verifyPassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  },
};

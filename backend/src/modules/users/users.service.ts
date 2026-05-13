import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { MASTER_ACCOUNT_EMAIL } from './bootstrap-master';

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
    return prisma.user.findUnique({ where: { email } });
  },

  async create(input: CreateUserInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const isMasterEmail = input.email.toLowerCase() === MASTER_ACCOUNT_EMAIL;
    return prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        // The designated master email is always promoted on creation so the
        // owner can pick up super-admin powers simply by registering.
        role: isMasterEmail ? 'master' : input.role ?? 'user',
        department: input.department ?? null,
      },
      select: SAFE_FIELDS,
    });
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

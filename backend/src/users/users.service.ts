import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: { department?: string; role?: string; isActive?: boolean } = {}) {
    return this.prisma.user.findMany({
      where: {
        ...(filters.department && { department: filters.department }),
        ...(filters.role && { role: filters.role }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      },
      select: {
        id: true, email: true, displayName: true, role: true,
        department: true, isActive: true, createdAt: true, updatedAt: true,
      },
      orderBy: { displayName: 'asc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, displayName: true, role: true,
        department: true, isActive: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; displayName: string; password: string; role?: string; department?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');
    const hashed = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: { ...data, password: hashed },
      select: {
        id: true, email: true, displayName: true, role: true,
        department: true, isActive: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async update(id: string, data: Partial<{ displayName: string; role: string; department: string; isActive: boolean; password: string }>) {
    await this.findById(id);
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, displayName: true, role: true,
        department: true, isActive: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async deactivate(id: string) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
  }
}

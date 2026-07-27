import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated'] as const;

export interface ContractFilters {
  status?: string;
  glCodeId?: string;
  vendor?: string;
  search?: string;
}

export interface CreateContractInput {
  contractNumber: string;
  title: string;
  vendor?: string | null;
  amount?: number | null;
  status?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  glCodeId?: string | null;
}

export type UpdateContractInput = Partial<CreateContractInput>;

const glCodeInclude = {
  glCode: { select: { id: true, code: true, name: true, category: true } },
} satisfies Prisma.ContractInclude;

async function assertGlCode(glCodeId: string | null | undefined) {
  if (!glCodeId) return;
  const glCode = await prisma.gLCode.findUnique({ where: { id: glCodeId } });
  if (!glCode) throw new ValidationError('GL code not found');
  if (!glCode.isActive) throw new ValidationError('GL code is inactive');
}

export const contractsService = {
  async list(filters: ContractFilters = {}) {
    const where: Prisma.ContractWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.glCodeId) where.glCodeId = filters.glCodeId;
    if (filters.vendor) where.vendor = filters.vendor;
    if (filters.search) {
      where.OR = [
        { contractNumber: { contains: filters.search } },
        { title: { contains: filters.search } },
        { vendor: { contains: filters.search } },
      ];
    }
    return prisma.contract.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: { ...glCodeInclude, _count: { select: { invoices: true } } },
    });
  },

  async getById(id: string) {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        ...glCodeInclude,
        invoices: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, invoiceNumber: true, amount: true, status: true },
        },
      },
    });
    if (!contract) throw new NotFoundError('Contract not found');
    return contract;
  },

  async create(input: CreateContractInput, userId?: string) {
    if (input.status && !CONTRACT_STATUSES.includes(input.status as (typeof CONTRACT_STATUSES)[number])) {
      throw new ValidationError('Invalid contract status');
    }
    await assertGlCode(input.glCodeId);
    const number = input.contractNumber.trim();
    const existing = await prisma.contract.findUnique({ where: { contractNumber: number } });
    if (existing) throw new ConflictError(`Contract ${number} already exists`);

    const contract = await prisma.contract.create({
      data: {
        contractNumber: number,
        title: input.title.trim(),
        vendor: input.vendor ?? null,
        amount: input.amount ?? null,
        status: input.status ?? 'draft',
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        glCodeId: input.glCodeId ?? null,
        createdById: userId ?? null,
      },
      include: glCodeInclude,
    });
    await activityService.log({
      entityType: 'contract',
      entityId: contract.id,
      action: 'created',
      newValue: { contractNumber: contract.contractNumber, glCodeId: contract.glCodeId },
      userId: userId ?? null,
    });
    return contract;
  },

  async update(id: string, input: UpdateContractInput, userId?: string) {
    const before = await this.getById(id);
    if (input.status && !CONTRACT_STATUSES.includes(input.status as (typeof CONTRACT_STATUSES)[number])) {
      throw new ValidationError('Invalid contract status');
    }
    if (input.glCodeId !== undefined) await assertGlCode(input.glCodeId);
    if (input.contractNumber && input.contractNumber.trim() !== before.contractNumber) {
      const clash = await prisma.contract.findUnique({
        where: { contractNumber: input.contractNumber.trim() },
      });
      if (clash) throw new ConflictError(`Contract ${input.contractNumber.trim()} already exists`);
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: {
        ...(input.contractNumber !== undefined ? { contractNumber: input.contractNumber.trim() } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        ...(input.glCodeId !== undefined ? { glCodeId: input.glCodeId } : {}),
      },
      include: glCodeInclude,
    });
    await activityService.log({
      entityType: 'contract',
      entityId: id,
      action: 'updated',
      oldValue: { status: before.status, glCodeId: before.glCodeId },
      newValue: { status: updated.status, glCodeId: updated.glCodeId },
      userId: userId ?? null,
    });
    return updated;
  },

  async remove(id: string, userId?: string) {
    await this.getById(id);
    await prisma.contract.delete({ where: { id } });
    await activityService.log({
      entityType: 'contract',
      entityId: id,
      action: 'deleted',
      userId: userId ?? null,
    });
  },
};

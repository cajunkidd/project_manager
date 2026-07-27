import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

const INVOICE_STATUSES = ['pending', 'approved', 'paid', 'void'] as const;

export interface InvoiceFilters {
  status?: string;
  glCodeId?: string;
  contractId?: string;
  vendor?: string;
  search?: string;
}

export interface CreateInvoiceInput {
  invoiceNumber: string;
  vendor?: string | null;
  amount: number;
  status?: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  glCodeId?: string | null;
  contractId?: string | null;
}

export type UpdateInvoiceInput = Partial<CreateInvoiceInput>;

const relationInclude = {
  glCode: { select: { id: true, code: true, name: true, category: true } },
  contract: { select: { id: true, contractNumber: true, title: true } },
} satisfies Prisma.InvoiceInclude;

async function assertGlCode(glCodeId: string | null | undefined) {
  if (!glCodeId) return;
  const glCode = await prisma.gLCode.findUnique({ where: { id: glCodeId } });
  if (!glCode) throw new ValidationError('GL code not found');
  if (!glCode.isActive) throw new ValidationError('GL code is inactive');
}

async function assertContract(contractId: string | null | undefined) {
  if (!contractId) return;
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) throw new ValidationError('Contract not found');
}

export const invoicesService = {
  async list(filters: InvoiceFilters = {}) {
    const where: Prisma.InvoiceWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.glCodeId) where.glCodeId = filters.glCodeId;
    if (filters.contractId) where.contractId = filters.contractId;
    if (filters.vendor) where.vendor = filters.vendor;
    if (filters.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search } },
        { vendor: { contains: filters.search } },
      ];
    }
    return prisma.invoice.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: relationInclude,
    });
  },

  async getById(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: relationInclude,
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  },

  async create(input: CreateInvoiceInput, userId?: string) {
    if (input.status && !INVOICE_STATUSES.includes(input.status as (typeof INVOICE_STATUSES)[number])) {
      throw new ValidationError('Invalid invoice status');
    }
    await assertGlCode(input.glCodeId);
    await assertContract(input.contractId);
    const number = input.invoiceNumber.trim();
    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: number } });
    if (existing) throw new ConflictError(`Invoice ${number} already exists`);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: number,
        vendor: input.vendor ?? null,
        amount: input.amount,
        status: input.status ?? 'pending',
        issueDate: input.issueDate ?? null,
        dueDate: input.dueDate ?? null,
        glCodeId: input.glCodeId ?? null,
        contractId: input.contractId ?? null,
        createdById: userId ?? null,
      },
      include: relationInclude,
    });
    await activityService.log({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'created',
      newValue: { invoiceNumber: invoice.invoiceNumber, glCodeId: invoice.glCodeId },
      userId: userId ?? null,
    });
    return invoice;
  },

  async update(id: string, input: UpdateInvoiceInput, userId?: string) {
    const before = await this.getById(id);
    if (input.status && !INVOICE_STATUSES.includes(input.status as (typeof INVOICE_STATUSES)[number])) {
      throw new ValidationError('Invalid invoice status');
    }
    if (input.glCodeId !== undefined) await assertGlCode(input.glCodeId);
    if (input.contractId !== undefined) await assertContract(input.contractId);
    if (input.invoiceNumber && input.invoiceNumber.trim() !== before.invoiceNumber) {
      const clash = await prisma.invoice.findUnique({
        where: { invoiceNumber: input.invoiceNumber.trim() },
      });
      if (clash) throw new ConflictError(`Invoice ${input.invoiceNumber.trim()} already exists`);
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber.trim() } : {}),
        ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.issueDate !== undefined ? { issueDate: input.issueDate } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.glCodeId !== undefined ? { glCodeId: input.glCodeId } : {}),
        ...(input.contractId !== undefined ? { contractId: input.contractId } : {}),
      },
      include: relationInclude,
    });
    await activityService.log({
      entityType: 'invoice',
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
    await prisma.invoice.delete({ where: { id } });
    await activityService.log({
      entityType: 'invoice',
      entityId: id,
      action: 'deleted',
      userId: userId ?? null,
    });
  },
};

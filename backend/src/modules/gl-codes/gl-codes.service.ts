import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { activityService } from '../activity/activity.service';

export interface GLCodeFilters {
  category?: string;
  isActive?: boolean;
  search?: string;
}

export interface CreateGLCodeInput {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isActive?: boolean;
}

export type UpdateGLCodeInput = Partial<CreateGLCodeInput>;

export interface GLCodeUploadRow {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isActive?: boolean;
}

export interface GLCodeUploadResult {
  created: number;
  updated: number;
  total: number;
  errors: { row: number; code?: string; message: string }[];
}

// Parse a simple CSV chart-of-accounts export. Recognizes an optional header
// row (code,name,description,category) and is forgiving about column order
// when a header is present. Quoted fields with embedded commas are supported.
export function parseGLCodeCsv(csv: string): GLCodeUploadRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const knownHeaders = ['code', 'name', 'description', 'category', 'active', 'isactive'];
  const firstCols = splitLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = firstCols.some((c) => knownHeaders.includes(c));

  let columns = ['code', 'name', 'description', 'category'];
  let startIdx = 0;
  if (hasHeader) {
    columns = firstCols.map((c) => (c === 'isactive' ? 'active' : c));
    startIdx = 1;
  }

  const rows: GLCodeUploadRow[] = [];
  for (let i = startIdx; i < lines.length; i += 1) {
    const cells = splitLine(lines[i]);
    const record: Record<string, string> = {};
    columns.forEach((col, idx) => {
      if (cells[idx] !== undefined) record[col] = cells[idx];
    });
    const row: GLCodeUploadRow = {
      code: record.code ?? '',
      name: record.name ?? '',
      description: record.description ? record.description : null,
      category: record.category ? record.category : null,
    };
    if (record.active !== undefined && record.active !== '') {
      row.isActive = !/^(false|0|no|inactive)$/i.test(record.active);
    }
    rows.push(row);
  }
  return rows;
}

export const glCodesService = {
  async list(filters: GLCodeFilters = {}) {
    const where: Prisma.GLCodeWhereInput = {};
    if (filters.category) where.category = filters.category;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }
    return prisma.gLCode.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      include: { _count: { select: { contracts: true, invoices: true } } },
    });
  },

  async getById(id: string) {
    const glCode = await prisma.gLCode.findUnique({
      where: { id },
      include: { _count: { select: { contracts: true, invoices: true } } },
    });
    if (!glCode) throw new NotFoundError('GL code not found');
    return glCode;
  },

  async create(input: CreateGLCodeInput, userId?: string) {
    const code = input.code.trim();
    if (!code) throw new ValidationError('GL code is required');
    const existing = await prisma.gLCode.findUnique({ where: { code } });
    if (existing) throw new ConflictError(`GL code ${code} already exists`);

    const glCode = await prisma.gLCode.create({
      data: {
        code,
        name: input.name.trim(),
        description: input.description ?? null,
        category: input.category ?? null,
        isActive: input.isActive ?? true,
        createdById: userId ?? null,
      },
    });
    await activityService.log({
      entityType: 'gl_code',
      entityId: glCode.id,
      action: 'created',
      newValue: { code: glCode.code, name: glCode.name },
      userId: userId ?? null,
    });
    return glCode;
  },

  async update(id: string, input: UpdateGLCodeInput, userId?: string) {
    const before = await this.getById(id);
    if (input.code && input.code.trim() !== before.code) {
      const clash = await prisma.gLCode.findUnique({ where: { code: input.code.trim() } });
      if (clash) throw new ConflictError(`GL code ${input.code.trim()} already exists`);
    }
    const updated = await prisma.gLCode.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await activityService.log({
      entityType: 'gl_code',
      entityId: id,
      action: 'updated',
      oldValue: { code: before.code, name: before.name, isActive: before.isActive },
      newValue: { code: updated.code, name: updated.name, isActive: updated.isActive },
      userId: userId ?? null,
    });
    return updated;
  },

  async remove(id: string, userId?: string) {
    const before = await this.getById(id);
    if (before._count.contracts > 0 || before._count.invoices > 0) {
      throw new ConflictError(
        'GL code is associated with contracts or invoices and cannot be deleted; deactivate it instead',
      );
    }
    await prisma.gLCode.delete({ where: { id } });
    await activityService.log({
      entityType: 'gl_code',
      entityId: id,
      action: 'deleted',
      userId: userId ?? null,
    });
  },

  // Bulk upload the company's chart of accounts. Rows are upserted by `code`
  // so re-uploading an updated export refreshes existing codes in place.
  async upload(rows: GLCodeUploadRow[], userId?: string): Promise<GLCodeUploadResult> {
    const result: GLCodeUploadResult = { created: 0, updated: 0, total: 0, errors: [] };
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i += 1) {
      const raw = rows[i];
      const code = (raw.code ?? '').trim();
      const name = (raw.name ?? '').trim();
      if (!code) {
        result.errors.push({ row: i + 1, message: 'Missing GL code' });
        continue;
      }
      if (!name) {
        result.errors.push({ row: i + 1, code, message: 'Missing name' });
        continue;
      }
      if (seen.has(code)) {
        result.errors.push({ row: i + 1, code, message: 'Duplicate code in upload' });
        continue;
      }
      seen.add(code);

      const data = {
        name,
        description: raw.description ?? null,
        category: raw.category ?? null,
        isActive: raw.isActive ?? true,
      };
      const existing = await prisma.gLCode.findUnique({ where: { code } });
      if (existing) {
        await prisma.gLCode.update({ where: { code }, data });
        result.updated += 1;
      } else {
        await prisma.gLCode.create({ data: { code, ...data, createdById: userId ?? null } });
        result.created += 1;
      }
      result.total += 1;
    }

    await activityService.log({
      entityType: 'gl_code',
      entityId: 'bulk',
      action: 'uploaded',
      newValue: { created: result.created, updated: result.updated, errors: result.errors.length },
      userId: userId ?? null,
    });
    return result;
  },
};

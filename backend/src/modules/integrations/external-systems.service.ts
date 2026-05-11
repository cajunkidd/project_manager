import { prisma } from '../../db/prisma';
import { NotFoundError, ValidationError } from '../../utils/errors';

export const EXTERNAL_SYSTEM_KINDS = [
  'teams',
  'outlook',
  'erp',
  'asset',
  'intranet',
  'monday',
  'other',
] as const;
export type ExternalSystemKind = (typeof EXTERNAL_SYSTEM_KINDS)[number];

export const ENTITY_TYPES = ['task', 'project'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface ExternalSystemConfig {
  webhookUrl?: string;
  linkTemplate?: string; // e.g. https://erp/example/work-order/{id}
  apiKey?: string;
  notes?: string;
  [k: string]: unknown;
}

export interface CreateSystemInput {
  name: string;
  kind: ExternalSystemKind;
  config: ExternalSystemConfig;
  events?: string[];
  isActive?: boolean;
}

export interface CreateLinkInput {
  systemId?: string | null;
  entityType: EntityType;
  entityId: string;
  externalId?: string | null;
  url?: string | null;
  label?: string | null;
}

function parseConfig(raw: string | null | undefined): ExternalSystemConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ExternalSystemConfig) : {};
  } catch {
    return {};
  }
}

function applyTemplate(template: string, params: { externalId?: string | null }): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key === 'id' || key === 'externalId') return params.externalId ?? '';
    return '';
  });
}

export const externalSystemsService = {
  async list() {
    const rows = await prisma.externalSystem.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({
      ...r,
      config: parseConfig(r.config),
      events: r.events ? r.events.split(',').filter(Boolean) : [],
    }));
  },

  async getById(id: string) {
    const row = await prisma.externalSystem.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('External system not found');
    return {
      ...row,
      config: parseConfig(row.config),
      events: row.events ? row.events.split(',').filter(Boolean) : [],
    };
  },

  async create(input: CreateSystemInput, userId?: string) {
    if (!EXTERNAL_SYSTEM_KINDS.includes(input.kind)) {
      throw new ValidationError(`Unknown system kind: ${input.kind}`);
    }
    return prisma.externalSystem.create({
      data: {
        name: input.name,
        kind: input.kind,
        config: JSON.stringify(input.config ?? {}),
        events: input.events?.length ? input.events.join(',') : null,
        isActive: input.isActive ?? true,
        createdById: userId ?? null,
      },
    });
  },

  async update(id: string, patch: Partial<CreateSystemInput>) {
    const current = await externalSystemsService.getById(id);
    return prisma.externalSystem.update({
      where: { id },
      data: {
        name: patch.name ?? current.name,
        kind: patch.kind ?? (current.kind as ExternalSystemKind),
        config: patch.config ? JSON.stringify(patch.config) : current.config
          ? JSON.stringify(current.config)
          : '{}',
        events:
          patch.events !== undefined
            ? patch.events.length
              ? patch.events.join(',')
              : null
            : current.events.length
              ? current.events.join(',')
              : null,
        isActive: patch.isActive ?? current.isActive,
      },
    });
  },

  async remove(id: string) {
    await prisma.externalSystem.delete({ where: { id } });
  },

  async findActiveByKind(kind: ExternalSystemKind) {
    const rows = await prisma.externalSystem.findMany({
      where: { kind, isActive: true },
    });
    return rows.map((r) => ({ ...r, config: parseConfig(r.config) }));
  },

  applyTemplate,
};

export const externalLinksService = {
  async listFor(entityType: EntityType, entityId: string) {
    return prisma.externalLink.findMany({
      where: { entityType, entityId },
      include: { system: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(input: CreateLinkInput) {
    if (!ENTITY_TYPES.includes(input.entityType)) {
      throw new ValidationError(`Unknown entity type: ${input.entityType}`);
    }
    let url = input.url ?? null;
    let label = input.label ?? null;
    if (input.systemId && !url) {
      const sys = await externalSystemsService.getById(input.systemId);
      if (sys.config.linkTemplate && input.externalId) {
        url = applyTemplate(sys.config.linkTemplate, { externalId: input.externalId });
      }
      if (!label) label = sys.name;
    }
    return prisma.externalLink.create({
      data: {
        systemId: input.systemId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        externalId: input.externalId ?? null,
        url,
        label,
      },
    });
  },

  async remove(id: string) {
    await prisma.externalLink.delete({ where: { id } });
  },
};

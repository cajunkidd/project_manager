import { prisma } from '../../db/prisma';
import { ValidationError } from '../../utils/errors';

// Subset of the Monday.com export shape we care about. We accept either the
// `boards` array format from monday.com's GraphQL `boards { items_page { items
// { ... } } }` exports, or a flat array of items.
export interface MondayColumnValue {
  id?: string;
  title?: string;
  type?: string;
  text?: string | null;
  value?: string | null;
}

export interface MondayItem {
  id?: string | number;
  name?: string;
  state?: string;
  column_values?: MondayColumnValue[];
  group?: { id?: string; title?: string };
  updates?: { body?: string }[];
  email?: string;
}

export interface MondayBoard {
  id?: string | number;
  name?: string;
  description?: string;
  items?: MondayItem[];
  items_page?: { items?: MondayItem[] };
}

export interface MondayExport {
  boards?: MondayBoard[];
  items?: MondayItem[];
}

export interface ImportSummary {
  projectsCreated: number;
  tasksCreated: number;
  usersCreated: number;
  usersMatched: number;
  unmappedAssignees: string[];
  projectIds: string[];
  taskIds: string[];
}

const STATUS_MAP: Record<string, string> = {
  done: 'done',
  complete: 'done',
  completed: 'done',
  closed: 'done',
  'in progress': 'in_progress',
  working: 'in_progress',
  'working on it': 'in_progress',
  doing: 'in_progress',
  stuck: 'waiting',
  blocked: 'waiting',
  waiting: 'waiting',
  review: 'review',
  qa: 'review',
  backlog: 'backlog',
  todo: 'to_do',
  'to do': 'to_do',
  'not started': 'to_do',
  open: 'to_do',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

const PRIORITY_MAP: Record<string, string> = {
  low: 'low',
  medium: 'normal',
  normal: 'normal',
  high: 'high',
  critical: 'urgent',
  urgent: 'urgent',
};

function normalizeStatus(raw: string | null | undefined): string {
  if (!raw) return 'to_do';
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'to_do';
}

function normalizePriority(raw: string | null | undefined): string {
  if (!raw) return 'normal';
  return PRIORITY_MAP[raw.trim().toLowerCase()] ?? 'normal';
}

function findColumn(item: MondayItem, ...types: string[]): MondayColumnValue | undefined {
  return item.column_values?.find(
    (c) =>
      (c.type && types.includes(c.type.toLowerCase())) ||
      (c.title && types.includes(c.title.toLowerCase())),
  );
}

function findColumnByTitle(item: MondayItem, ...titles: string[]): MondayColumnValue | undefined {
  return item.column_values?.find(
    (c) => c.title && titles.map((t) => t.toLowerCase()).includes(c.title.toLowerCase()),
  );
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Monday date columns: "{\"date\":\"2026-05-15\"}" or a plain date in `text`.
  try {
    if (value.startsWith('{')) {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed.date === 'string') return new Date(parsed.date);
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  } catch {
    /* ignore */
  }
  return null;
}

function parsePeopleEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.personsAndTeams?.[0]?.email) return String(parsed.personsAndTeams[0].email);
    if (typeof parsed?.email === 'string') return parsed.email;
  } catch {
    /* ignore */
  }
  return value.includes('@') ? value : null;
}

export const mondayService = {
  async import(payload: MondayExport, actorId?: string): Promise<ImportSummary> {
    if (!payload || (!payload.boards && !payload.items)) {
      throw new ValidationError('Payload must include boards or items');
    }

    const summary: ImportSummary = {
      projectsCreated: 0,
      tasksCreated: 0,
      usersCreated: 0,
      usersMatched: 0,
      unmappedAssignees: [],
      projectIds: [],
      taskIds: [],
    };

    const job = await prisma.importJob.create({
      data: { source: 'monday', status: 'running', createdById: actorId ?? null },
    });

    const userByEmail = new Map<string, string>();
    async function ensureUserByEmail(email: string): Promise<string | null> {
      const normalized = email.trim().toLowerCase();
      if (!normalized) return null;
      const cached = userByEmail.get(normalized);
      if (cached) return cached;
      let user = await prisma.user.findUnique({ where: { email: normalized } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: normalized,
            displayName: normalized.split('@')[0],
            passwordHash: 'imported',
            role: 'user',
            isActive: false,
          },
        });
        summary.usersCreated += 1;
      } else {
        summary.usersMatched += 1;
      }
      userByEmail.set(normalized, user.id);
      return user.id;
    }

    try {
      const boards = payload.boards ?? [
        { name: 'Imported from Monday.com', items: payload.items ?? [] },
      ];

      for (const board of boards) {
        const project = await prisma.project.create({
          data: {
            name: board.name?.trim() || 'Imported board',
            description: board.description ?? null,
            createdById: actorId ?? null,
          },
        });
        summary.projectsCreated += 1;
        summary.projectIds.push(project.id);

        const items = board.items ?? board.items_page?.items ?? [];
        for (const item of items) {
          const statusColumn = findColumn(item, 'status', 'color');
          const priorityColumn = findColumnByTitle(item, 'priority');
          const dueColumn = findColumn(item, 'date', 'timeline', 'date1');
          const peopleColumn = findColumn(item, 'people', 'multiple-person', 'person');
          const longText = findColumn(item, 'long-text', 'text');

          const status = normalizeStatus(statusColumn?.text ?? statusColumn?.value ?? item.state);
          const priority = normalizePriority(priorityColumn?.text ?? priorityColumn?.value);
          const dueDate = parseDate(dueColumn?.value ?? dueColumn?.text ?? null);
          const email = parsePeopleEmail(peopleColumn?.value ?? null) ?? item.email ?? null;
          const assigneeId = email ? await ensureUserByEmail(email) : null;
          if (email && !assigneeId) summary.unmappedAssignees.push(email);

          const task = await prisma.task.create({
            data: {
              projectId: project.id,
              title: (item.name ?? 'Untitled').trim() || 'Untitled',
              description: longText?.text ?? null,
              status,
              priority,
              dueDate,
              assignedToId: assigneeId,
              createdById: actorId ?? null,
            },
          });
          summary.tasksCreated += 1;
          summary.taskIds.push(task.id);
        }
      }

      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: 'success',
          summary: JSON.stringify(summary),
          completedAt: new Date(),
        },
      });
      return summary;
    } catch (err) {
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          log: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });
      throw err;
    }
  },

  async listJobs() {
    return prisma.importJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  },
};

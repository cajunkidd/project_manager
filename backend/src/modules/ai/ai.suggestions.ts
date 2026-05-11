import { prisma } from '../../db/prisma';
import { TASK_OPEN_STATUSES, type Priority } from './ai.constants';

const DAY_MS = 86_400_000;

const PRIORITY_RANK: Record<Priority, number> = { low: 0, normal: 1, high: 2, urgent: 3 };

const URGENT_KEYWORDS = ['asap', 'urgent', 'immediately', 'critical', 'p0', 'emergency', 'production down', 'outage'];
const HIGH_KEYWORDS = ['important', 'priority', 'p1', 'today', 'eod', 'deadline'];

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'will',
  'with', 'we', 'you', 'i', 'our', 'their', 'there', 'than', 'then', 'so', 'do',
  'does', 'did', 'can', 'could', 'should', 'would', 'his', 'her', 'its', 'they',
  'them', 'us', 'me', 'my', 'your', 'about', 'into', 'over', 'after', 'before',
  'task', 'tasks', 'item', 'items', 'todo', 'tbd', 'wip',
]);

interface PrioritizableTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignedToId: string | null;
  updatedAt: Date;
  projectId?: string | null;
}

export interface PrioritySuggestion {
  taskId: string;
  title: string;
  currentPriority: Priority;
  suggestedPriority: Priority;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
}

function asPriority(p: string): Priority {
  if (p === 'low' || p === 'normal' || p === 'high' || p === 'urgent') return p;
  return 'normal';
}

function detectFromText(text: string): Priority | null {
  const lower = text.toLowerCase();
  if (URGENT_KEYWORDS.some((k) => lower.includes(k))) return 'urgent';
  if (HIGH_KEYWORDS.some((k) => lower.includes(k))) return 'high';
  return null;
}

export function suggestPriorities(
  tasks: PrioritizableTask[],
  now = new Date(),
): PrioritySuggestion[] {
  const out: PrioritySuggestion[] = [];
  for (const t of tasks) {
    if (!(TASK_OPEN_STATUSES as readonly string[]).includes(t.status)) continue;
    const current = asPriority(t.priority);
    const reasons: string[] = [];
    let suggested: Priority = current;
    let confidence: 'low' | 'medium' | 'high' = 'low';

    if (t.dueDate) {
      const daysToDue = (t.dueDate.getTime() - now.getTime()) / DAY_MS;
      if (daysToDue < 0) {
        if (PRIORITY_RANK[current] < PRIORITY_RANK.urgent) {
          suggested = 'urgent';
          confidence = 'high';
          reasons.push(`Overdue by ${Math.ceil(-daysToDue)} day(s)`);
        }
      } else if (daysToDue < 2 && PRIORITY_RANK[current] < PRIORITY_RANK.high) {
        suggested = 'high';
        confidence = 'high';
        reasons.push('Due within 48 hours');
      } else if (daysToDue < 7 && PRIORITY_RANK[current] < PRIORITY_RANK.high) {
        suggested = 'high';
        confidence = 'medium';
        reasons.push('Due within a week');
      }
    }

    const text = `${t.title} ${t.description ?? ''}`;
    const fromKeywords = detectFromText(text);
    if (fromKeywords && PRIORITY_RANK[fromKeywords] > PRIORITY_RANK[suggested]) {
      suggested = fromKeywords;
      confidence = fromKeywords === 'urgent' ? 'high' : 'medium';
      reasons.push(`Title/description signals "${fromKeywords}" priority`);
    }

    if (t.status === 'in_progress' && current === 'low') {
      if (PRIORITY_RANK[suggested] < PRIORITY_RANK.normal) {
        suggested = 'normal';
        confidence = confidence === 'low' ? 'medium' : confidence;
        reasons.push('In progress but flagged low priority');
      }
    }

    const stalledDays = Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY_MS);
    if (
      stalledDays >= 21 &&
      PRIORITY_RANK[current] >= PRIORITY_RANK.high &&
      t.status !== 'waiting'
    ) {
      if (PRIORITY_RANK.normal < PRIORITY_RANK[suggested] || suggested === current) {
        suggested = 'normal';
        confidence = 'low';
        reasons.push(`No activity in ${stalledDays} days — consider de-prioritizing`);
      }
    }

    if (suggested !== current && reasons.length) {
      out.push({
        taskId: t.id,
        title: t.title,
        currentPriority: current,
        suggestedPriority: suggested,
        confidence,
        reasons,
      });
    }
  }
  return out;
}

export type CleanupAction =
  | 'archive_stale'
  | 'close_orphan'
  | 'assign_owner'
  | 'add_due_date'
  | 'split_task'
  | 'reactivate';

export interface CleanupSuggestion {
  taskId: string;
  title: string;
  action: CleanupAction;
  reason: string;
}

export function suggestCleanup(
  tasks: PrioritizableTask[],
  now = new Date(),
): CleanupSuggestion[] {
  const out: CleanupSuggestion[] = [];
  for (const t of tasks) {
    const ageDays = Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY_MS);
    const isOpen = (TASK_OPEN_STATUSES as readonly string[]).includes(t.status);

    if (isOpen && t.status === 'backlog' && ageDays >= 90) {
      out.push({
        taskId: t.id,
        title: t.title,
        action: 'archive_stale',
        reason: `In backlog with no activity for ${ageDays} days`,
      });
      continue;
    }
    if (isOpen && ageDays >= 60 && !t.assignedToId && !t.dueDate) {
      out.push({
        taskId: t.id,
        title: t.title,
        action: 'archive_stale',
        reason: `${ageDays} days old with no owner and no due date`,
      });
      continue;
    }
    if (isOpen && !t.assignedToId && t.status === 'in_progress') {
      out.push({
        taskId: t.id,
        title: t.title,
        action: 'assign_owner',
        reason: 'In progress without an assignee',
      });
    }
    if (isOpen && !t.dueDate && t.status === 'in_progress') {
      out.push({
        taskId: t.id,
        title: t.title,
        action: 'add_due_date',
        reason: 'In progress without a due date',
      });
    }
    if (isOpen && t.title.trim().length < 5) {
      out.push({
        taskId: t.id,
        title: t.title,
        action: 'split_task',
        reason: 'Title is too short to be actionable',
      });
    }
    if (isOpen && t.title.length > 140 && !t.description) {
      out.push({
        taskId: t.id,
        title: t.title,
        action: 'split_task',
        reason: 'Long single-line task may need to be broken into subtasks',
      });
    }
  }
  return out;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface DuplicateGroup {
  similarity: number;
  tasks: { id: string; title: string; projectId: string | null; status: string }[];
}

export function findDuplicateTasks(
  tasks: PrioritizableTask[],
  threshold = 0.6,
): DuplicateGroup[] {
  const tokens = tasks.map((t) => tokenize(`${t.title} ${t.description ?? ''}`));
  const parent = tasks.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const pairSims = new Map<string, number>();
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const sim = jaccard(tokens[i], tokens[j]);
      if (sim >= threshold) {
        const a = Math.min(i, j);
        const b = Math.max(i, j);
        pairSims.set(`${a}:${b}`, sim);
        union(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < tasks.length; i += 1) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const out: DuplicateGroup[] = [];
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    let maxSim = 0;
    for (let i = 0; i < indices.length; i += 1) {
      for (let j = i + 1; j < indices.length; j += 1) {
        const a = Math.min(indices[i], indices[j]);
        const b = Math.max(indices[i], indices[j]);
        const s = pairSims.get(`${a}:${b}`) ?? 0;
        if (s > maxSim) maxSim = s;
      }
    }
    out.push({
      similarity: Number(maxSim.toFixed(2)),
      tasks: indices.map((i) => ({
        id: tasks[i].id,
        title: tasks[i].title,
        projectId: tasks[i].projectId ?? null,
        status: tasks[i].status,
      })),
    });
  }
  return out.sort((a, b) => b.similarity - a.similarity);
}

export async function loadTasksForSuggestions(projectId?: string): Promise<PrioritizableTask[]> {
  return prisma.task.findMany({
    where: projectId ? { projectId } : {},
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      assignedToId: true,
      updatedAt: true,
      projectId: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
}

import type { Priority, TaskStatus } from './ai.constants';
import {
  TASK_BLOCKED_STATUSES,
  TASK_OPEN_STATUSES,
} from './ai.constants';
import type {
  ExtractedTask,
  ProjectAIContext,
  ProjectSummary,
  RiskScore,
} from './ai.types';

const URGENT_KEYWORDS = ['asap', 'urgent', 'immediately', 'critical', 'p0', 'emergency'];
const HIGH_KEYWORDS = ['important', 'priority', 'p1', 'high priority', 'today', 'eod'];
const LOW_KEYWORDS = ['eventually', 'someday', 'when possible', 'low priority', 'p3'];

const ACTION_VERBS = [
  'add',
  'build',
  'check',
  'configure',
  'contact',
  'coordinate',
  'create',
  'deploy',
  'document',
  'draft',
  'email',
  'enable',
  'escalate',
  'fix',
  'follow up',
  'install',
  'investigate',
  'migrate',
  'notify',
  'open',
  'order',
  'patch',
  'plan',
  'prepare',
  'publish',
  'reach out',
  'remove',
  'replace',
  'request',
  'reset',
  'review',
  'schedule',
  'send',
  'set up',
  'submit',
  'sync',
  'test',
  'update',
  'upgrade',
  'verify',
  'write',
];

const DAY_MS = 86_400_000;

function detectPriority(text: string): Priority {
  const lower = text.toLowerCase();
  if (URGENT_KEYWORDS.some((k) => lower.includes(k))) return 'urgent';
  if (HIGH_KEYWORDS.some((k) => lower.includes(k))) return 'high';
  if (LOW_KEYWORDS.some((k) => lower.includes(k))) return 'low';
  return 'normal';
}

function detectDueDate(text: string, now = new Date()): string | null {
  const lower = text.toLowerCase();
  // ISO date
  const iso = lower.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return new Date(iso[1]).toISOString();

  if (lower.includes('today') || lower.includes('eod')) {
    const d = new Date(now);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
  if (lower.includes('tomorrow')) {
    const d = new Date(now.getTime() + DAY_MS);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
  if (lower.includes('this week') || lower.includes('end of week')) {
    const d = new Date(now);
    const offset = (5 - d.getDay() + 7) % 7 || 5;
    d.setDate(d.getDate() + offset);
    d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }
  if (lower.includes('next week')) {
    const d = new Date(now.getTime() + 7 * DAY_MS);
    return d.toISOString();
  }
  return null;
}

function looksLikeAction(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;
  const lower = trimmed.toLowerCase();
  if (ACTION_VERBS.some((v) => lower.startsWith(`${v} `) || lower.startsWith(`${v},`))) {
    return true;
  }
  // Numbered or bulleted lists are usually intentional
  if (/^([-*•]|\d+[.)])/.test(trimmed)) return true;
  // "we need to ...", "please ..."
  if (/^(we need to|please|let's|let us|todo:)/i.test(trimmed)) return true;
  // Urgency prefix like "ASAP:" or "URGENT —"
  if (/^(asap|urgent|critical|emergency|p[0-3])\s*[:\-—]/i.test(trimmed)) return true;
  // Body with an action verb anywhere
  if (
    trimmed.length < 160 &&
    ACTION_VERBS.some((v) => new RegExp(`(^|\\s)${v}\\b`, 'i').test(trimmed))
  ) {
    return true;
  }
  return false;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/^(we need to|please|let's|let us|todo:)\s*/i, '')
    .replace(/^(asap|urgent|critical|emergency|p[0-3])\s*[:\-—]\s*/i, '')
    .trim();
}

function splitIntoCandidates(text: string): string[] {
  // Prefer line breaks; fall back to sentence splits.
  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  // Otherwise split on sentence boundaries.
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractTasksFromText(input: string, now = new Date()): ExtractedTask[] {
  const candidates = splitIntoCandidates(input);
  const tasks: ExtractedTask[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!looksLikeAction(candidate) && candidates.length === 1) {
      // Single block, no clear bullets — treat the whole thing as one task.
      tasks.push({
        title: candidate.length > 80 ? `${candidate.slice(0, 77)}…` : candidate,
        description: candidate.length > 80 ? candidate : null,
        priority: detectPriority(candidate),
        status: 'to_do' as TaskStatus,
        dueDate: detectDueDate(candidate, now),
      });
      continue;
    }
    if (!looksLikeAction(candidate)) continue;
    const title = cleanTitle(candidate);
    if (!title) continue;
    tasks.push({
      title: title.length > 100 ? `${title.slice(0, 97)}…` : title,
      description: null,
      priority: detectPriority(candidate),
      status: 'to_do' as TaskStatus,
      dueDate: detectDueDate(candidate, now),
    });
  }
  return tasks;
}

export function summarizeProject(ctx: ProjectAIContext, now = new Date()): ProjectSummary {
  const open = ctx.tasks.filter((t) => (TASK_OPEN_STATUSES as readonly string[]).includes(t.status));
  const completed = ctx.tasks.filter((t) => t.status === 'done');
  const overdue = open.filter(
    (t) => t.dueDate !== null && t.dueDate.getTime() < now.getTime(),
  );
  const blocked = ctx.tasks.filter((t) =>
    (TASK_BLOCKED_STATUSES as readonly string[]).includes(t.status),
  );
  const unassigned = open.filter((t) => !t.assignedToId);

  const recommendations: string[] = [];
  if (overdue.length) recommendations.push(`Resolve or reschedule ${overdue.length} overdue task(s).`);
  if (blocked.length) recommendations.push(`Unblock ${blocked.length} waiting task(s).`);
  if (unassigned.length) recommendations.push(`Assign ${unassigned.length} task(s) without an owner.`);
  const daysSinceUpdate = Math.floor(
    (now.getTime() - ctx.lastActivityAt.getTime()) / DAY_MS,
  );
  if (daysSinceUpdate >= 7) recommendations.push(`No activity in ${daysSinceUpdate} days — check in with the team.`);
  if (
    ctx.project.dueDate &&
    open.length > 0 &&
    ctx.project.dueDate.getTime() - now.getTime() < 7 * DAY_MS &&
    ctx.project.dueDate.getTime() > now.getTime()
  ) {
    recommendations.push('Project due within a week with open work — consider a final review.');
  }
  if (recommendations.length === 0) recommendations.push('No immediate risks detected.');

  let headline: string;
  if (overdue.length) {
    headline = `${ctx.project.name} is at risk: ${overdue.length} overdue task(s).`;
  } else if (open.length === 0 && ctx.tasks.length > 0) {
    headline = `${ctx.project.name} is fully wrapped up.`;
  } else if (blocked.length) {
    headline = `${ctx.project.name} has ${blocked.length} blocker(s) to clear.`;
  } else if (open.length === 0) {
    headline = `${ctx.project.name} has no tasks yet.`;
  } else {
    headline = `${ctx.project.name} is on track with ${open.length} open task(s).`;
  }

  return {
    status: ctx.project.status,
    headline,
    completed: completed.slice(0, 5).map((t) => t.title),
    open: open.slice(0, 5).map((t) => t.title),
    overdue: overdue.slice(0, 5).map((t) => t.title),
    blockers: blocked.slice(0, 5).map((t) => t.title),
    recommendations,
    metrics: {
      totalTasks: ctx.tasks.length,
      completedTasks: completed.length,
      overdueTasks: overdue.length,
      blockedTasks: blocked.length,
      unassignedTasks: unassigned.length,
    },
  };
}

export function scoreProjectRisk(ctx: ProjectAIContext, now = new Date()): RiskScore {
  const open = ctx.tasks.filter((t) => (TASK_OPEN_STATUSES as readonly string[]).includes(t.status));
  const overdue = open.filter(
    (t) => t.dueDate !== null && t.dueDate.getTime() < now.getTime(),
  );
  const blocked = ctx.tasks.filter((t) =>
    (TASK_BLOCKED_STATUSES as readonly string[]).includes(t.status),
  );
  const unassigned = open.filter((t) => !t.assignedToId);
  const daysSinceUpdate = Math.floor(
    (now.getTime() - ctx.lastActivityAt.getTime()) / DAY_MS,
  );
  const daysToDue = ctx.project.dueDate
    ? Math.floor((ctx.project.dueDate.getTime() - now.getTime()) / DAY_MS)
    : null;

  const factors: RiskScore['factors'] = [];
  let score = 0;

  if (overdue.length) {
    const impact = Math.min(40, overdue.length * 8);
    score += impact;
    factors.push({
      label: 'Overdue tasks',
      impact,
      detail: `${overdue.length} task(s) past their due date.`,
    });
  }
  if (blocked.length) {
    const impact = Math.min(20, blocked.length * 5);
    score += impact;
    factors.push({
      label: 'Blocked tasks',
      impact,
      detail: `${blocked.length} task(s) waiting on something.`,
    });
  }
  if (unassigned.length) {
    const impact = Math.min(15, unassigned.length * 3);
    score += impact;
    factors.push({
      label: 'Unassigned work',
      impact,
      detail: `${unassigned.length} open task(s) without an owner.`,
    });
  }
  if (daysSinceUpdate >= 7) {
    const impact = Math.min(15, Math.floor(daysSinceUpdate / 2));
    score += impact;
    factors.push({
      label: 'Stalled activity',
      impact,
      detail: `${daysSinceUpdate} days since last update.`,
    });
  }
  if (daysToDue !== null && daysToDue >= 0 && daysToDue <= 14 && open.length > 0) {
    const impact = Math.max(5, 20 - daysToDue);
    score += impact;
    factors.push({
      label: 'Due-date pressure',
      impact,
      detail: `${daysToDue} day(s) until due with ${open.length} open task(s).`,
    });
  }
  if (daysToDue !== null && daysToDue < 0 && open.length > 0) {
    score += 25;
    factors.push({
      label: 'Past project due date',
      impact: 25,
      detail: 'Project due date has passed but work remains.',
    });
  }

  score = Math.max(0, Math.min(100, score));
  const level: RiskScore['level'] =
    score < 20 ? 'low' : score < 40 ? 'moderate' : score < 70 ? 'elevated' : 'high';

  let explanation: string;
  if (score === 0) explanation = 'No risk factors detected.';
  else {
    const parts = factors.slice().sort((a, b) => b.impact - a.impact).map((f) => f.label.toLowerCase());
    explanation = `Risk driven primarily by ${parts.slice(0, 2).join(' and ')}.`;
  }

  return { score, level, explanation, factors };
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
}

export interface DuplicateGroup {
  similarity: number;
  tasks: DuplicateCandidate[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'to', 'of', 'for', 'in', 'on', 'at', 'with', 'by',
  'is', 'are', 'be', 'will', 'this', 'that', 'it', 'as', 'or', 'from',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function findDuplicateTasks(
  tasks: DuplicateCandidate[],
  threshold = 0.6,
): DuplicateGroup[] {
  const tokenized = tasks.map((task) => ({ task, tokens: tokenize(task.title) }));
  const seen = new Set<string>();
  const groups: DuplicateGroup[] = [];

  for (let i = 0; i < tokenized.length; i += 1) {
    if (seen.has(tokenized[i].task.id)) continue;
    const cluster: DuplicateCandidate[] = [tokenized[i].task];
    let bestSimilarity = 0;
    for (let j = i + 1; j < tokenized.length; j += 1) {
      if (seen.has(tokenized[j].task.id)) continue;
      const similarity = jaccard(tokenized[i].tokens, tokenized[j].tokens);
      if (similarity >= threshold) {
        cluster.push(tokenized[j].task);
        seen.add(tokenized[j].task.id);
        if (similarity > bestSimilarity) bestSimilarity = similarity;
      }
    }
    if (cluster.length > 1) {
      seen.add(tokenized[i].task.id);
      groups.push({ similarity: Number(bestSimilarity.toFixed(2)), tasks: cluster });
    }
  }

  groups.sort((a, b) => b.similarity - a.similarity);
  return groups;
}

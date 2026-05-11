import { extractTasksFromText } from './ai.heuristic';
import type { ExtractedTask } from './ai.types';

export interface MeetingNotesResult {
  title: string | null;
  meetingDate: string | null;
  attendees: string[];
  agenda: string[];
  decisions: string[];
  actionItems: (ExtractedTask & { assignee: string | null })[];
  summary: string;
}

const SECTION_PATTERNS: { key: keyof SectionMap; patterns: RegExp[] }[] = [
  {
    key: 'attendees',
    patterns: [
      /^\s*(attendees|attending|participants|present)\s*[:\-—]/i,
    ],
  },
  {
    key: 'agenda',
    patterns: [/^\s*(agenda|topics)\s*[:\-—]/i],
  },
  {
    key: 'decisions',
    patterns: [/^\s*(decisions?|decided|outcomes?|resolutions?)\s*[:\-—]/i],
  },
  {
    key: 'actions',
    patterns: [
      /^\s*(action items?|actions?|next steps|todos?|to-?do)\s*[:\-—]/i,
    ],
  },
  {
    key: 'notes',
    patterns: [/^\s*(notes?|discussion|summary)\s*[:\-—]/i],
  },
];

type SectionKey = 'attendees' | 'agenda' | 'decisions' | 'actions' | 'notes';
type SectionMap = Record<SectionKey, string[]>;

function classifyLine(line: string): SectionKey | null {
  for (const { key, patterns } of SECTION_PATTERNS) {
    if (patterns.some((re) => re.test(line))) return key as SectionKey;
  }
  return null;
}

function stripBullet(s: string): string {
  return s.replace(/^[-*•\d.)\s]+/, '').trim();
}

function detectMeetingDate(text: string): string | null {
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return new Date(iso[1]).toISOString();
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (us) {
    const [, m, d, y] = us;
    const yyyy = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(yyyy, Number(m) - 1, Number(d));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  return null;
}

function detectTitle(text: string): string | null {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!firstLine) return null;
  const m = firstLine.match(/^\s*(?:#+\s*)?(?:meeting\s*[:\-—]\s*)?(.{4,120})$/i);
  if (!m) return null;
  // Avoid pulling section headers as titles
  if (classifyLine(firstLine)) return null;
  return m[1].trim();
}

function parseAttendees(lines: string[]): string[] {
  const out = new Set<string>();
  for (const line of lines) {
    const cleaned = stripBullet(line);
    if (!cleaned) continue;
    const parts = cleaned.split(/[,;]|\s+and\s+/i);
    for (const p of parts) {
      const name = p.trim().replace(/[()<>].*$/, '').trim();
      if (name && name.length <= 60 && /[a-z]/i.test(name)) out.add(name);
    }
  }
  return [...out];
}

function extractAssignee(line: string): { line: string; assignee: string | null } {
  // Patterns: "@name", "(Name)", "— Name", "owner: name", "assigned to name"
  let assignee: string | null = null;
  let cleaned = line;

  const at = cleaned.match(/@([A-Za-z][A-Za-z0-9_.\-]{1,40})/);
  if (at) {
    assignee = at[1];
    cleaned = cleaned.replace(at[0], '').trim();
  }
  const owner = cleaned.match(/\b(?:owner|assignee|assigned to|owner:|@)\s*[:\-]?\s*([A-Z][A-Za-z .'-]{1,40})/);
  if (!assignee && owner) {
    assignee = owner[1].trim();
    cleaned = cleaned.replace(owner[0], '').trim();
  }
  const paren = cleaned.match(/\(([A-Z][A-Za-z .'-]{1,40})\)\s*$/);
  if (!assignee && paren) {
    assignee = paren[1].trim();
    cleaned = cleaned.replace(paren[0], '').trim();
  }
  const dash = cleaned.match(/[—\-]\s*([A-Z][A-Za-z]{1,30}(?:\s+[A-Z][A-Za-z]{1,30})?)\s*$/);
  if (!assignee && dash) {
    assignee = dash[1].trim();
    cleaned = cleaned.replace(dash[0], '').trim();
  }

  return { line: cleaned, assignee };
}

export function parseMeetingNotes(text: string, now = new Date()): MeetingNotesResult {
  const lines = text.split(/\r?\n/);
  const sections: SectionMap = {
    attendees: [],
    agenda: [],
    decisions: [],
    actions: [],
    notes: [],
  };

  let current: SectionKey | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const section = classifyLine(line);
    if (section) {
      current = section;
      const after = line.replace(/^[^:]*[:\-—]\s*/, '').trim();
      if (after) sections[current].push(after);
      continue;
    }
    if (current) {
      sections[current].push(line);
    } else {
      sections.notes.push(line);
    }
  }

  const attendees = parseAttendees(sections.attendees);
  const agenda = sections.agenda.map(stripBullet).filter(Boolean);
  const decisions = sections.decisions.map(stripBullet).filter(Boolean);

  const actionSource = sections.actions.length
    ? sections.actions.join('\n')
    : sections.notes.join('\n');

  const rawActions = sections.actions.length
    ? sections.actions
    : extractTasksFromText(actionSource, now).map((t) => t.title);

  const actionItems: (ExtractedTask & { assignee: string | null })[] = [];
  for (const raw of rawActions) {
    const { line, assignee } = extractAssignee(raw);
    const extracted = extractTasksFromText(line, now);
    const first = extracted[0];
    if (!first) continue;
    actionItems.push({ ...first, assignee });
  }

  // Build a short summary
  const summaryParts: string[] = [];
  if (attendees.length) summaryParts.push(`${attendees.length} attendee(s)`);
  if (decisions.length) summaryParts.push(`${decisions.length} decision(s)`);
  if (actionItems.length) summaryParts.push(`${actionItems.length} action item(s)`);
  const summary = summaryParts.length
    ? `Meeting captured: ${summaryParts.join(', ')}.`
    : 'Meeting notes parsed with no structured items.';

  return {
    title: detectTitle(text),
    meetingDate: detectMeetingDate(text),
    attendees,
    agenda,
    decisions,
    actionItems,
    summary,
  };
}

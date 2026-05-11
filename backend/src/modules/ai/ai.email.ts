import { extractTasksFromText } from './ai.heuristic';
import type { ExtractedTask } from './ai.types';

export interface EmailMessage {
  from: string;
  to?: string[];
  subject?: string;
  body: string;
  sentAt?: string;
}

export interface EmailThreadSummary {
  subject: string | null;
  participants: string[];
  messageCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  summary: string;
  keyPoints: string[];
  actionItems: ExtractedTask[];
  questions: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgent: boolean;
}

const QUOTE_PREFIX = /^>+\s?/;
const SIGNATURE_BREAK = /^(--\s*$|sent from my |best,?$|thanks,?$|regards,?$|cheers,?$|sincerely,?$)/i;
const REPLY_HEADER = /^(on .* wrote:|from: .*|-----original message-----)/i;

const POSITIVE = ['thanks', 'thank you', 'great', 'appreciate', 'awesome', 'perfect', 'good job', 'nice work', 'love it'];
const NEGATIVE = ['concerned', 'frustrated', 'angry', 'unhappy', 'unacceptable', 'broken', 'failure', 'failed', 'disappointed', 'critical', 'blocker'];
const URGENT_TERMS = ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'production down', 'p0', 'outage'];

function stripQuotes(body: string): string {
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (QUOTE_PREFIX.test(line)) continue;
    if (REPLY_HEADER.test(line.trim())) break;
    if (SIGNATURE_BREAK.test(line.trim())) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueOrdered<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function detectSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE) if (lower.includes(w)) pos += 1;
  for (const w of NEGATIVE) if (lower.includes(w)) neg += 1;
  if (neg > pos && neg >= 1) return 'negative';
  if (pos > neg && pos >= 1) return 'positive';
  return 'neutral';
}

export function summarizeEmailThread(thread: EmailMessage[], now = new Date()): EmailThreadSummary {
  if (!Array.isArray(thread) || thread.length === 0) {
    return {
      subject: null,
      participants: [],
      messageCount: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      summary: 'Empty thread.',
      keyPoints: [],
      actionItems: [],
      questions: [],
      sentiment: 'neutral',
      urgent: false,
    };
  }

  const participants = uniqueOrdered(
    thread.flatMap((m) => [m.from, ...(m.to ?? [])]).filter((p): p is string => Boolean(p)),
  );
  const subject =
    thread.find((m) => m.subject)?.subject?.replace(/^(re:|fwd:|fw:)\s*/i, '').trim() ?? null;

  const dates = thread
    .map((m) => (m.sentAt ? new Date(m.sentAt) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));
  const firstMessageAt = dates.length
    ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString()
    : null;
  const lastMessageAt = dates.length
    ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString()
    : null;

  const cleanedBodies = thread.map((m) => ({ from: m.from, body: stripQuotes(m.body || '') }));
  const fullText = cleanedBodies.map((m) => m.body).join('\n');

  const keyPoints: string[] = [];
  for (const m of cleanedBodies) {
    const sentences = splitSentences(m.body);
    if (sentences.length === 0) continue;
    const lead = sentences.slice(0, 2).join(' ');
    if (lead) {
      const sender = m.from.split('@')[0];
      keyPoints.push(`${sender}: ${lead.length > 200 ? `${lead.slice(0, 197)}…` : lead}`);
    }
  }

  const questions = uniqueOrdered(
    splitSentences(fullText).filter((s) => s.endsWith('?') && s.length > 8 && s.length < 240),
  ).slice(0, 8);

  const actionItems = extractTasksFromText(fullText, now);

  const lower = fullText.toLowerCase();
  const urgent = URGENT_TERMS.some((t) => lower.includes(t));
  const sentiment = detectSentiment(fullText);

  const summary = [
    `Thread of ${thread.length} message(s) between ${participants.length} participant(s)`,
    actionItems.length ? `with ${actionItems.length} action item(s)` : null,
    questions.length ? `${questions.length} open question(s)` : null,
    urgent ? 'flagged urgent' : null,
  ]
    .filter(Boolean)
    .join(', ') + '.';

  return {
    subject,
    participants,
    messageCount: thread.length,
    firstMessageAt,
    lastMessageAt,
    summary,
    keyPoints: keyPoints.slice(0, 8),
    actionItems,
    questions,
    sentiment,
    urgent,
  };
}

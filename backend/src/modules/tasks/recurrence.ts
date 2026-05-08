export type RecurrenceRule =
  | { type: 'interval'; days: number }
  | { type: 'weekly'; weekdays: number[] } // 0=Sunday..6=Saturday
  | { type: 'monthly'; day: number };       // day of month, 1..28

export function parseRecurrence(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RecurrenceRule;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.type === 'interval' && Number.isInteger(parsed.days) && parsed.days > 0) return parsed;
    if (
      parsed.type === 'weekly' &&
      Array.isArray(parsed.weekdays) &&
      parsed.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    )
      return parsed;
    if (
      parsed.type === 'monthly' &&
      Number.isInteger(parsed.day) &&
      parsed.day >= 1 &&
      parsed.day <= 28
    )
      return parsed;
    return null;
  } catch {
    return null;
  }
}

export function nextOccurrence(rule: RecurrenceRule, from = new Date()): Date {
  const base = new Date(from);
  base.setHours(23, 59, 0, 0);
  if (rule.type === 'interval') {
    base.setDate(base.getDate() + rule.days);
    return base;
  }
  if (rule.type === 'weekly') {
    const allowed = new Set(rule.weekdays);
    if (!allowed.size) {
      base.setDate(base.getDate() + 7);
      return base;
    }
    for (let offset = 1; offset <= 14; offset += 1) {
      const candidate = new Date(base);
      candidate.setDate(candidate.getDate() + offset);
      if (allowed.has(candidate.getDay())) return candidate;
    }
    base.setDate(base.getDate() + 7);
    return base;
  }
  // monthly
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  next.setDate(rule.day);
  return next;
}

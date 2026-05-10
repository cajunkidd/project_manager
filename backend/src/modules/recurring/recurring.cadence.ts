export type Cadence = 'daily' | 'weekly' | 'monthly';

export interface CadenceConfig {
  cadence: Cadence;
  intervalCount: number; // every N
  dayOfWeek: number | null; // 0..6, used for weekly
  dayOfMonth: number | null; // 1..31, used for monthly
  hourOfDay: number; // 0..23
}

/**
 * Computes the next occurrence at or after `from`. Always returns a Date
 * strictly later than `from` so a template that just fired re-arms cleanly.
 */
export function computeNextRunAt(cfg: CadenceConfig, from: Date): Date {
  const interval = Math.max(1, cfg.intervalCount);
  const next = new Date(from.getTime());
  next.setHours(cfg.hourOfDay, 0, 0, 0);
  // Ensure strictly after `from`
  if (next.getTime() <= from.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  if (cfg.cadence === 'daily') {
    // step in `interval` day buckets from the seed day
    const diffDays = Math.floor((next.getTime() - from.getTime()) / 86_400_000);
    if (diffDays % interval !== 0) {
      const add = interval - (diffDays % interval);
      next.setDate(next.getDate() + add);
    }
    return next;
  }

  if (cfg.cadence === 'weekly') {
    const targetDow = cfg.dayOfWeek ?? from.getDay();
    while (next.getDay() !== targetDow) {
      next.setDate(next.getDate() + 1);
    }
    if (interval > 1) {
      const baseWeek = Math.floor(from.getTime() / (7 * 86_400_000));
      const nextWeek = Math.floor(next.getTime() / (7 * 86_400_000));
      const wkDiff = nextWeek - baseWeek;
      if (wkDiff % interval !== 0) {
        next.setDate(next.getDate() + (interval - (wkDiff % interval)) * 7);
      }
    }
    return next;
  }

  // monthly
  const targetDom = cfg.dayOfMonth ?? from.getDate();
  // Move forward in month chunks of `interval` until we land on a date strictly after `from`
  const candidate = new Date(from.getFullYear(), from.getMonth(), 1, cfg.hourOfDay, 0, 0, 0);
  while (true) {
    const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    const day = Math.min(targetDom, lastDay);
    const try_ = new Date(
      candidate.getFullYear(),
      candidate.getMonth(),
      day,
      cfg.hourOfDay,
      0,
      0,
      0,
    );
    if (try_.getTime() > from.getTime()) return try_;
    candidate.setMonth(candidate.getMonth() + interval);
  }
}

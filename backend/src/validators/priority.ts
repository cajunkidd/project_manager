export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export type Priority = (typeof PRIORITIES)[number];

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

const RANK: Record<Priority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

export function comparePriority(a: Priority, b: Priority): number {
  return RANK[a] - RANK[b];
}

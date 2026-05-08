import { useMemo } from 'react';

type RecurrenceRule =
  | { type: 'interval'; days: number }
  | { type: 'weekly'; weekdays: number[] };

const PRESETS: { label: string; value: string | null }[] = [
  { label: "Doesn't repeat", value: null },
  { label: 'Every day', value: JSON.stringify({ type: 'interval', days: 1 }) },
  { label: 'Every week', value: JSON.stringify({ type: 'interval', days: 7 }) },
  { label: 'Every 2 weeks', value: JSON.stringify({ type: 'interval', days: 14 }) },
  { label: 'Every month', value: JSON.stringify({ type: 'interval', days: 30 }) },
  {
    label: 'Mon / Wed / Fri',
    value: JSON.stringify({ type: 'weekly', weekdays: [1, 3, 5] }),
  },
];

export function describeRecurrence(raw: string | null | undefined): string {
  if (!raw) return "Doesn't repeat";
  try {
    const rule = JSON.parse(raw) as RecurrenceRule;
    if (rule.type === 'interval') {
      if (rule.days === 1) return 'Every day';
      if (rule.days === 7) return 'Every week';
      if (rule.days === 14) return 'Every 2 weeks';
      if (rule.days === 30) return 'Every month';
      return `Every ${rule.days} days`;
    }
    if (rule.type === 'weekly') {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `Weekly · ${rule.weekdays
        .slice()
        .sort()
        .map((d) => names[d])
        .join(', ')}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

export function RecurrencePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const matchingPreset = useMemo(() => {
    if (!value) return PRESETS[0];
    return PRESETS.find((p) => p.value === value) ?? null;
  }, [value]);

  return (
    <div className="row" style={{ gap: 8 }}>
      <select
        value={matchingPreset?.value ?? '__custom__'}
        onChange={(e) => {
          if (e.target.value === '__custom__') return;
          onChange(e.target.value === 'null' ? null : e.target.value || null);
        }}
        style={{ maxWidth: 240 }}
      >
        {PRESETS.map((p) => (
          <option key={p.label} value={p.value === null ? 'null' : p.value}>
            {p.label}
          </option>
        ))}
        {matchingPreset === null ? (
          <option value="__custom__">Custom: {describeRecurrence(value)}</option>
        ) : null}
      </select>
    </div>
  );
}

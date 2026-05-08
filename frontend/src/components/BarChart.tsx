import type { ReactElement } from 'react';

export interface BarChartDatum {
  label: string;
  value: number;
  hint?: string;
}

interface BarChartProps {
  data: BarChartDatum[];
  max?: number;
  height?: number;
  emptyMessage?: string;
}

export function BarChart({
  data,
  max,
  height = 18,
  emptyMessage = 'No data',
}: BarChartProps): ReactElement {
  if (!data.length) return <div className="muted">{emptyMessage}</div>;
  const ceiling = Math.max(max ?? 0, ...data.map((d) => d.value), 1);

  return (
    <div className="bar-chart">
      {data.map((d) => {
        const pct = (d.value / ceiling) * 100;
        return (
          <div className="bar-row" key={d.label}>
            <div className="bar-label" title={d.label}>
              {d.label}
            </div>
            <div className="bar-track" style={{ height }}>
              <div
                className="bar-fill"
                style={{ width: `${pct}%`, height }}
                title={d.hint ?? `${d.value}`}
              />
            </div>
            <div className="bar-value">{d.value}</div>
          </div>
        );
      })}
    </div>
  );
}

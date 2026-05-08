import type { ReactElement } from 'react';

export interface TrendChartDatum {
  label: string;
  value: number;
}

export function TrendChart({
  data,
  height = 160,
  emptyMessage = 'No data',
}: {
  data: TrendChartDatum[];
  height?: number;
  emptyMessage?: string;
}): ReactElement {
  if (!data.length) return <div className="muted">{emptyMessage}</div>;

  const max = Math.max(...data.map((d) => d.value), 1);
  const width = Math.max(data.length * 60, 240);
  const padX = 28;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((d, i) => {
    const x = padX + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
    const y = padY + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x.toFixed(1)},${(padY + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(padY + innerH).toFixed(1)} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
      <line
        x1={padX}
        x2={width - padX}
        y1={padY + innerH}
        y2={padY + innerH}
        stroke="var(--border)"
      />
      <path d={areaD} fill="rgba(37, 99, 235, 0.12)" />
      <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth={2} />
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r={3} fill="var(--primary)" />
          <text
            x={p.x}
            y={height - 2}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted)"
          >
            {p.label}
          </text>
          <text
            x={p.x}
            y={p.y - 6}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text)"
          >
            {p.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

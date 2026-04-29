import { AlertTriangle, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

const STYLES = {
  low:      { cls: 'bg-green-50 text-green-700 border-green-200',   Icon: ShieldCheck,  label: 'Low risk' },
  medium:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',   Icon: ShieldAlert,  label: 'Medium risk' },
  high:     { cls: 'bg-orange-50 text-orange-700 border-orange-200', Icon: AlertTriangle, label: 'High risk' },
  critical: { cls: 'bg-red-50 text-red-700 border-red-200',         Icon: ShieldX,      label: 'Critical risk' },
} as const;

interface Props {
  level: 'low' | 'medium' | 'high' | 'critical' | string;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md';
}

export default function RiskBadge({ level, score, showScore = true, size = 'sm' }: Props) {
  const style = STYLES[(level as keyof typeof STYLES)] ?? STYLES.low;
  const { cls, Icon, label } = style;
  const padding = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  const iconSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <span className={`inline-flex items-center gap-1 rounded border font-medium ${padding} ${cls}`}>
      <Icon className={iconSize} />
      {label}
      {showScore && typeof score === 'number' && <span className="opacity-70">· {score}</span>}
    </span>
  );
}

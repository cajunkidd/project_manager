import type { ReactElement } from 'react';
import type { RiskScore } from '../api/ai';

const LEVEL_CLASS: Record<RiskScore['level'], string> = {
  low: 'risk-low',
  moderate: 'risk-moderate',
  elevated: 'risk-elevated',
  high: 'risk-high',
};

export function RiskBadge({ risk }: { risk: RiskScore }): ReactElement {
  return (
    <span
      className={`badge ${LEVEL_CLASS[risk.level]}`}
      data-testid="risk-badge"
      title={risk.explanation}
    >
      Risk {risk.score} · {risk.level}
    </span>
  );
}

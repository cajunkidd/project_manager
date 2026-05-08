import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RiskBadge } from './RiskBadge';

describe('RiskBadge', () => {
  it('renders score and level', () => {
    render(
      <RiskBadge
        risk={{
          score: 42,
          level: 'elevated',
          explanation: 'mostly overdue',
          factors: [],
        }}
      />,
    );
    const badge = screen.getByTestId('risk-badge');
    expect(badge).toHaveTextContent('Risk 42');
    expect(badge).toHaveTextContent('elevated');
    expect(badge).toHaveClass('risk-elevated');
  });

  it('uses level-specific class for low risk', () => {
    render(
      <RiskBadge risk={{ score: 5, level: 'low', explanation: 'fine', factors: [] }} />,
    );
    expect(screen.getByTestId('risk-badge')).toHaveClass('risk-low');
  });
});

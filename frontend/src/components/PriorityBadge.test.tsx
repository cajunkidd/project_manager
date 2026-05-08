import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriorityBadge } from './PriorityBadge';

describe('PriorityBadge', () => {
  it('renders the label for a known priority', () => {
    render(<PriorityBadge priority="urgent" />);
    expect(screen.getByTestId('priority-badge')).toHaveTextContent('Urgent');
  });

  it('applies the priority class', () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByTestId('priority-badge')).toHaveClass('priority-high');
  });

  it('falls back to raw value for unknown priority', () => {
    render(<PriorityBadge priority="critical" />);
    expect(screen.getByTestId('priority-badge')).toHaveTextContent('critical');
  });
});

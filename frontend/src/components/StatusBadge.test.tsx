import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the human-readable label for a known status', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('In Progress');
  });

  it('preserves the raw status as a data attribute', () => {
    render(<StatusBadge status="on_hold" />);
    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-status', 'on_hold');
  });

  it('falls back to the raw value for unknown statuses', () => {
    render(<StatusBadge status="archived" />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('archived');
  });
});

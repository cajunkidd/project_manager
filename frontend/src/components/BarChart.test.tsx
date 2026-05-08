import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarChart } from './BarChart';

describe('BarChart', () => {
  it('renders rows with labels and values', () => {
    render(
      <BarChart
        data={[
          { label: 'Alice', value: 3 },
          { label: 'Bob', value: 1 },
        ]}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows the empty message when data is empty', () => {
    render(<BarChart data={[]} emptyMessage="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });

  it('scales bar widths relative to the highest value', () => {
    const { container } = render(
      <BarChart
        data={[
          { label: 'A', value: 5 },
          { label: 'B', value: 10 },
        ]}
      />,
    );
    const fills = container.querySelectorAll('.bar-fill');
    expect(fills).toHaveLength(2);
    expect((fills[0] as HTMLElement).style.width).toBe('50%');
    expect((fills[1] as HTMLElement).style.width).toBe('100%');
  });
});

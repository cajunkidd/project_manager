import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePolling } from './usePolling';

describe('usePolling', () => {
  it('runs the fetcher on mount and stores the result', async () => {
    const fetcher = vi.fn().mockResolvedValue('hello');
    const { result } = renderHook(() =>
      usePolling(fetcher, [], { intervalMs: 60_000, pauseWhenHidden: false }),
    );

    await waitFor(() => expect(result.current.data).toBe('hello'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('re-runs at the configured interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('tick');
    renderHook(() => usePolling(fetcher, [], { intervalMs: 30, pauseWhenHidden: false }));

    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(3), {
      timeout: 1500,
    });
  });

  it('exposes errors and recovers when the fetcher succeeds again', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok');
    const { result, rerender } = renderHook(
      ({ dep }: { dep: string }) =>
        usePolling(fetcher, [dep], { intervalMs: 60_000, pauseWhenHidden: false }),
      { initialProps: { dep: 'a' } },
    );

    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
    rerender({ dep: 'b' });
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.error).toBeNull();
  });

  it('does not poll while disabled, then runs once when re-enabled', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        usePolling(fetcher, [], { intervalMs: 30, pauseWhenHidden: false, enabled }),
      { initialProps: { enabled: false } },
    );

    await new Promise((r) => setTimeout(r, 120));
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });

  it('re-runs when deps change', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok');
    const { rerender } = renderHook(
      ({ dep }: { dep: string }) =>
        usePolling(fetcher, [dep], { intervalMs: 60_000, pauseWhenHidden: false }),
      { initialProps: { dep: 'a' } },
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ dep: 'b' });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});

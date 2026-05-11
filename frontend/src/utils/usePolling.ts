import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingOptions {
  /** Milliseconds between polls. Defaults to 15s. */
  intervalMs?: number;
  /** Pause polling while the document is hidden. Defaults to true. */
  pauseWhenHidden?: boolean;
  /** Disable polling entirely (e.g. while a modal is open). */
  enabled?: boolean;
}

export interface PollingResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Lightweight polling hook. Runs the fetcher on mount and at a fixed
 * interval; pauses when the tab is hidden so a background window does
 * not keep hitting the server.
 *
 * Re-runs (and resets the interval) when any value in `deps` changes,
 * so callers can plug in filters/route params without manual wiring.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: PollingOptions = {},
): PollingResult<T> {
  const { intervalMs = 15_000, pauseWhenHidden = true, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep the latest fetcher in a ref so the interval doesn't capture a stale
  // closure. Callers can pass an inline arrow function without thrashing.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const inFlightRef = useRef(false);

  const run = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run();
    const tick = () => {
      if (pauseWhenHidden && typeof document !== 'undefined' && document.hidden) return;
      run();
    };
    const id = window.setInterval(tick, intervalMs);

    let visibilityHandler: (() => void) | null = null;
    if (pauseWhenHidden && typeof document !== 'undefined') {
      visibilityHandler = () => {
        if (!document.hidden) run();
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    return () => {
      window.clearInterval(id);
      if (visibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, pauseWhenHidden, enabled, ...deps]);

  return { data, error, loading, refresh: run };
}

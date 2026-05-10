import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { timeEntriesApi } from '../api/timeEntries';
import type { TimeEntry } from '../types';

interface ActiveTimerCtx {
  active: TimeEntry | null;
  refresh: () => Promise<void>;
  start: (taskId: string, note?: string | null) => Promise<TimeEntry>;
  stop: () => Promise<TimeEntry>;
}

const Ctx = createContext<ActiveTimerCtx | null>(null);

const POLL_MS = 30_000;

export function ActiveTimerProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<TimeEntry | null>(null);

  const refresh = useCallback(async () => {
    try {
      const a = await timeEntriesApi.active();
      setActive(a);
    } catch {
      // Swallow — auth errors etc. shouldn't crash the shell
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const start = useCallback(
    async (taskId: string, note?: string | null) => {
      const entry = await timeEntriesApi.start(taskId, note ?? null);
      setActive(entry);
      return entry;
    },
    [],
  );

  const stop = useCallback(async () => {
    const entry = await timeEntriesApi.stop();
    setActive(null);
    return entry;
  }, []);

  const value = useMemo(() => ({ active, refresh, start, stop }), [active, refresh, start, stop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveTimer(): ActiveTimerCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useActiveTimer must be used inside ActiveTimerProvider');
  return v;
}

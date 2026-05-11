import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { getToken } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export type RealtimeEventType =
  | 'project.created'
  | 'project.updated'
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'task.assigned'
  | 'comment.created';

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: Record<string, unknown>;
}

type Listener = (event: RealtimeEvent) => void;

interface RealtimeState {
  connected: boolean;
  subscribe: (listener: Listener) => () => void;
}

const RealtimeContext = createContext<RealtimeState | undefined>(undefined);

const API_BASE =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE ?? '/api';

const ALL_EVENT_TYPES: RealtimeEventType[] = [
  'project.created',
  'project.updated',
  'task.created',
  'task.updated',
  'task.status_changed',
  'task.assigned',
  'comment.created',
];

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Set<Listener>());

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;

    const url = `${API_BASE}/realtime/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    const dispatch = (type: RealtimeEventType) => (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        listenersRef.current.forEach((fn) => fn({ type, data }));
      } catch {
        // ignore malformed event
      }
    };

    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('error', () => setConnected(false));
    for (const type of ALL_EVENT_TYPES) {
      source.addEventListener(type, dispatch(type));
    }

    return () => {
      source.close();
      setConnected(false);
    };
  }, [user]);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}

export interface LiveUpdateOptions {
  types?: RealtimeEventType[];
  filter?: (event: RealtimeEvent) => boolean;
}

/**
 * Calls `onEvent` whenever a matching realtime event arrives.
 * Typically used to trigger a refetch of the page's data.
 */
export function useLiveUpdates(
  onEvent: (event: RealtimeEvent) => void,
  { types, filter }: LiveUpdateOptions = {},
): void {
  const { subscribe } = useRealtime();
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    return subscribe((event) => {
      if (types && !types.includes(event.type)) return;
      if (filter && !filter(event)) return;
      cbRef.current(event);
    });
  }, [subscribe, types, filter]);
}

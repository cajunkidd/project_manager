import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// Single source of truth for opening the global TaskDrawer via the
// `?task=<id>` URL param. Lets the bell, lists, and cards deep-link
// into a task without prop-drilling drawer state.

export function useTaskOpener() {
  const [params, setParams] = useSearchParams();

  const open = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.set("task", id);
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  const close = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("task");
    setParams(next, { replace: false });
  }, [params, setParams]);

  return { open, close, taskId: params.get("task") };
}

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Notification } from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";

interface BellData {
  items: Notification[];
  unread: number;
}

export default function NotificationBell() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(getCurrentUserId());

  useEffect(() => {
    const handler = () => setUserId(getCurrentUserId());
    window.addEventListener("pm:user-changed", handler);
    return () => window.removeEventListener("pm:user-changed", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const { data } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => api.get<BellData>(`/notifications?userId=${userId}`),
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  const markAll = useMutation({
    mutationFn: () => api.patch("/notifications/read-all", { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  function openTarget(n: Notification) {
    if (!n.isRead) markOne.mutate(n.id);
    setOpen(false);
    if (n.entityType === "project" && n.entityId) {
      nav(`/projects/${n.entityId}`);
    } else if (n.entityType === "task") {
      // Tasks open via drawer in their lists; route to My Tasks for now.
      nav(`/my-tasks`);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-8 h-8 rounded hover:bg-slate-100 text-slate-600"
        aria-label="Notifications"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] leading-none font-bold rounded-full px-1.5 py-0.5">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              className="text-xs text-brand hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openTarget(n)}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 ${
                    !n.isRead ? "bg-brand-subtle" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-slate-900">{n.title}</div>
                  <div className="text-xs text-slate-600 line-clamp-2">{n.message}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-500">
                No notifications.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  ApiTokenRow,
  WebhookDelivery,
  WebhookEvent,
  WebhookSubscriptionRow,
} from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";

const ALL_EVENTS: WebhookEvent[] = [
  "task_created",
  "task_updated",
  "project_created",
  "project_updated",
  "form_submitted",
];

export default function Integrations() {
  return (
    <div className="p-6 max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      <ApiTokensSection />
      <WebhooksSection />
    </div>
  );
}

function ApiTokensSection() {
  const qc = useQueryClient();
  const { data: tokens = [] } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () => api.get<ApiTokenRow[]>("/api-tokens"),
  });
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<{ name: string; token: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post<{ token: string; name: string }>("/api-tokens", {
        name,
        createdById: getCurrentUserId(),
      }),
    onSuccess: (res) => {
      setRevealed({ name: res.name, token: res.token });
      setName("");
      qc.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api-tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-tokens"] }),
  });

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">API tokens</h2>
      <p className="text-xs text-slate-500">
        Use a bearer token to call <code>/api/v1/*</code> from external systems.
        Currently exposes <code>POST /api/v1/tasks</code>, <code>GET /api/v1/tasks</code>, and <code>GET /api/v1/projects</code>.
      </p>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. asset-manager-sync"
          className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm"
        />
        <button
          disabled={!name || create.isPending}
          onClick={() => create.mutate()}
          className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
        >
          Generate token
        </button>
      </div>

      {revealed && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
          <div className="text-sm font-medium text-amber-900">
            Save this token now — it won't be shown again.
          </div>
          <div className="font-mono text-xs bg-white border border-amber-300 rounded p-2 break-all">
            {revealed.token}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-amber-800">{revealed.name}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(revealed.token);
              }}
              className="text-xs border border-amber-300 hover:bg-amber-100 rounded px-2 py-1"
            >
              Copy
            </button>
            <button
              onClick={() => setRevealed(null)}
              className="text-xs text-amber-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-slate-600 text-left">
          <tr>
            <th className="py-1 font-medium">Name</th>
            <th className="py-1 font-medium">Prefix</th>
            <th className="py-1 font-medium">Last used</th>
            <th className="py-1 font-medium">Status</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tokens.map((t) => (
            <tr key={t.id}>
              <td className="py-1.5">{t.name}</td>
              <td className="py-1.5 font-mono text-xs text-slate-600">{t.prefix}…</td>
              <td className="py-1.5 text-slate-600">
                {t.lastUsedAt
                  ? new Date(t.lastUsedAt).toLocaleString()
                  : "—"}
              </td>
              <td className="py-1.5">
                <span
                  className={
                    t.isActive ? "text-emerald-700" : "text-slate-400"
                  }
                >
                  {t.isActive ? "Active" : "Revoked"}
                </span>
              </td>
              <td className="py-1.5 text-right">
                {t.isActive && (
                  <button
                    onClick={() => {
                      if (confirm(`Revoke "${t.name}"?`)) revoke.mutate(t.id);
                    }}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
          {tokens.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-slate-500 text-sm">
                No tokens.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function WebhooksSection() {
  const qc = useQueryClient();
  const { data: subs = [] } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => api.get<WebhookSubscriptionRow[]>("/webhooks"),
  });
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<WebhookEvent>>(new Set(ALL_EVENTS));
  const [revealed, setRevealed] = useState<{ url: string; secret: string } | null>(null);
  const [openDeliveriesFor, setOpenDeliveriesFor] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post<{ secret: string; url: string }>("/webhooks", {
        url,
        events: [...events],
        createdById: getCurrentUserId(),
      }),
    onSuccess: (res) => {
      setRevealed({ url: res.url, secret: res.secret });
      setUrl("");
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const toggle = useMutation({
    mutationFn: (sub: WebhookSubscriptionRow) =>
      api.patch(`/webhooks/${sub.id}`, { isActive: !sub.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  function flip(e: WebhookEvent) {
    setEvents((s) => {
      const next = new Set(s);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">Outbound webhooks</h2>
      <p className="text-xs text-slate-500">
        We POST a JSON payload to your URL when subscribed events fire.
        Each delivery is signed with HMAC-SHA256 in the{" "}
        <code>X-PM-Signature</code> header (format: <code>sha256=&lt;hex&gt;</code>).
      </p>

      <div className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/hooks/pm"
          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {ALL_EVENTS.map((ev) => (
            <label key={ev} className="text-xs flex items-center gap-1 border border-slate-200 rounded px-2 py-1">
              <input
                type="checkbox"
                checked={events.has(ev)}
                onChange={() => flip(ev)}
              />
              {ev}
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            disabled={!url || events.size === 0 || create.isPending}
            onClick={() => create.mutate()}
            className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            Add webhook
          </button>
        </div>
      </div>

      {revealed && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
          <div className="text-sm font-medium text-amber-900">
            Signing secret — won't be shown again.
          </div>
          <div className="font-mono text-xs bg-white border border-amber-300 rounded p-2 break-all">
            {revealed.secret}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => navigator.clipboard?.writeText(revealed.secret)}
              className="text-xs border border-amber-300 hover:bg-amber-100 rounded px-2 py-1"
            >
              Copy
            </button>
            <button
              onClick={() => setRevealed(null)}
              className="text-xs text-amber-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {subs.map((s) => (
          <li key={s.id} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.url}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {s.events.join(", ")} · {s._count?.deliveries ?? 0} deliveries
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={s.isActive}
                    onChange={() => toggle.mutate(s)}
                  />
                  Active
                </label>
                <button
                  onClick={() =>
                    setOpenDeliveriesFor(openDeliveriesFor === s.id ? null : s.id)
                  }
                  className="text-xs border border-slate-300 hover:bg-slate-100 rounded px-2 py-1"
                >
                  {openDeliveriesFor === s.id ? "Hide" : "Deliveries"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this webhook?")) remove.mutate(s.id);
                  }}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
            {openDeliveriesFor === s.id && <Deliveries id={s.id} />}
          </li>
        ))}
        {subs.length === 0 && (
          <li className="py-4 text-center text-slate-500 text-sm">
            No webhook subscriptions.
          </li>
        )}
      </ul>
    </section>
  );
}

function Deliveries({ id }: { id: string }) {
  const { data = [] } = useQuery({
    queryKey: ["webhook-deliveries", id],
    queryFn: () => api.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries`),
    refetchInterval: 10_000,
  });
  if (data.length === 0)
    return <div className="text-xs text-slate-500 mt-2 ml-2">No deliveries yet.</div>;
  return (
    <ul className="mt-2 ml-2 space-y-1">
      {data.map((d) => (
        <li key={d.id} className="text-xs flex items-center justify-between">
          <span>
            <span className={d.ok ? "text-emerald-700" : "text-rose-700"}>
              {d.ok ? "✓" : "✗"}
            </span>{" "}
            {d.event}{" "}
            <span className="text-slate-400">
              {new Date(d.createdAt).toLocaleString()}
            </span>
          </span>
          <span className="text-slate-500">
            {d.status ?? "—"}
            {d.error ? ` · ${d.error}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

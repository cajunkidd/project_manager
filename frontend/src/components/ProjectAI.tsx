import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Priority, User } from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";
import { useTaskOpener } from "../lib/openTask";

interface RiskResponse {
  score: number;
  level: "low" | "medium" | "high";
  explanation: string;
  signals: {
    overdue: number;
    blocked: number;
    unassigned: number;
    daysSinceActivity: number;
    dueProximityDays: number | null;
    openTasks: number;
  };
}

interface SummaryResponse {
  summary: string;
  generatedAt: string;
}

interface AIStatus {
  enabled: boolean;
  model: string;
}

interface TaskSuggestion {
  title: string;
  description: string | null;
  priority: Priority;
  assignedToUserId: string | null;
  assigneeRationale: string | null;
  dueDate: string | null;
}

export default function ProjectAI({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { open: openTask } = useTaskOpener();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [extractText, setExtractText] = useState("");
  const [showExtract, setShowExtract] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => api.get<AIStatus>("/ai/status"),
    staleTime: 5 * 60_000,
  });

  const { data: risk } = useQuery({
    queryKey: ["risk", projectId],
    queryFn: () => api.get<RiskResponse>(`/ai/risk/${projectId}`),
    refetchInterval: 60_000,
  });

  const summarize = useMutation({
    mutationFn: () => api.post<SummaryResponse>(`/ai/summary/${projectId}`, {}),
    onSuccess: (data) => {
      setSummary(data);
      setError(null);
    },
    onError: (e: Error) => setError(toFriendly(e)),
  });

  const extract = useMutation({
    mutationFn: (text: string) =>
      api.post<{ suggestions: TaskSuggestion[] }>("/ai/extract-tasks", {
        projectId,
        text,
      }),
    onSuccess: ({ suggestions }) => {
      setSuggestions(suggestions);
      setError(null);
    },
    onError: (e: Error) => setError(toFriendly(e)),
  });

  async function createTasks(picked: TaskSuggestion[]) {
    for (const s of picked) {
      await api.post("/tasks", {
        projectId,
        title: s.title,
        description: s.description,
        priority: s.priority,
        assignedToId: s.assignedToUserId ?? undefined,
        dueDate: s.dueDate ?? undefined,
        createdById: getCurrentUserId(),
      });
    }
    setSuggestions(null);
    setShowExtract(false);
    setExtractText("");
    qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    qc.invalidateQueries({ queryKey: ["risk", projectId] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Project insights</h2>

      {risk && <RiskCard risk={risk} />}

      <div className="flex gap-2 flex-wrap">
        <button
          disabled={!status?.enabled || summarize.isPending}
          onClick={() => summarize.mutate()}
          className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
        >
          {summarize.isPending ? "Summarizing…" : "AI summary"}
        </button>
        <button
          disabled={!status?.enabled}
          onClick={() => setShowExtract(true)}
          className="border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded"
        >
          Extract tasks from notes
        </button>
        {!status?.enabled && (
          <span className="text-xs text-amber-700 self-center">
            Set <code>ANTHROPIC_API_KEY</code> on the backend to enable AI.
          </span>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded px-3 py-2">
          {error}
        </div>
      )}

      {summary && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3">
          <div className="text-xs text-slate-500 mb-1">
            Generated {new Date(summary.generatedAt).toLocaleString()}
          </div>
          <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans">
            {summary.summary}
          </pre>
        </div>
      )}

      {showExtract && (
        <ExtractDialog
          text={extractText}
          onTextChange={setExtractText}
          onClose={() => {
            setShowExtract(false);
            setSuggestions(null);
          }}
          onExtract={() => extract.mutate(extractText)}
          isExtracting={extract.isPending}
          suggestions={suggestions}
          onCreate={createTasks}
          openTask={openTask}
        />
      )}
    </section>
  );
}

function RiskCard({ risk }: { risk: RiskResponse }) {
  const tone =
    risk.level === "high"
      ? "bg-rose-50 border-rose-200 text-rose-800"
      : risk.level === "medium"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : "bg-emerald-50 border-emerald-200 text-emerald-800";
  const bar =
    risk.level === "high"
      ? "bg-rose-500"
      : risk.level === "medium"
      ? "bg-amber-500"
      : "bg-emerald-500";
  return (
    <div className={`border rounded p-3 ${tone}`}>
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wide font-semibold">
          Risk · {risk.level}
        </div>
        <div className="text-2xl font-semibold">{risk.score}</div>
      </div>
      <div className="h-1.5 bg-white/60 rounded mt-1 overflow-hidden">
        <div
          className={`h-1.5 ${bar}`}
          style={{ width: `${risk.score}%` }}
        />
      </div>
      <p className="text-sm mt-2">{risk.explanation}</p>
    </div>
  );
}

function ExtractDialog({
  text,
  onTextChange,
  onClose,
  onExtract,
  isExtracting,
  suggestions,
  onCreate,
  openTask: _openTask,
}: {
  text: string;
  onTextChange: (s: string) => void;
  onClose: () => void;
  onExtract: () => void;
  isExtracting: boolean;
  suggestions: TaskSuggestion[] | null;
  onCreate: (picked: TaskSuggestion[]) => Promise<void>;
  openTask: (id: string) => void;
}) {
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
  const [picked, setPicked] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Extract tasks from notes</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {!suggestions ? (
          <>
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              rows={8}
              placeholder="Paste meeting notes, an email, or a brain-dump. Each task you mention will be extracted and reviewed before creation."
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">
                Cancel
              </button>
              <button
                disabled={text.trim().length < 10 || isExtracting}
                onClick={onExtract}
                className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
              >
                {isExtracting ? "Extracting…" : "Extract"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-slate-500">
              Review the {suggestions.length} suggestion
              {suggestions.length === 1 ? "" : "s"} before creating tasks.
            </div>
            <ul className="space-y-2">
              {suggestions.map((s, i) => {
                const assignee = users.find((u) => u.id === s.assignedToUserId);
                const isPicked = picked.has(i);
                return (
                  <li
                    key={i}
                    className={`border rounded p-3 ${
                      isPicked ? "border-brand bg-brand-subtle" : "border-slate-200"
                    }`}
                  >
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isPicked}
                        onChange={() => toggle(i)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{s.title}</div>
                        {s.description && (
                          <div className="text-xs text-slate-600 mt-0.5">
                            {s.description}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded">
                            {s.priority}
                          </span>
                          <span>
                            {assignee ? `→ ${assignee.displayName}` : "Unassigned"}
                          </span>
                          {s.dueDate && (
                            <span>
                              · due {new Date(s.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
              {suggestions.length === 0 && (
                <li className="text-sm text-slate-500">
                  No tasks extracted from the input.
                </li>
              )}
            </ul>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  if (picked.size === suggestions.length) setPicked(new Set());
                  else setPicked(new Set(suggestions.map((_, i) => i)));
                }}
                className="text-xs text-brand hover:underline"
              >
                {picked.size === suggestions.length ? "Deselect all" : "Select all"}
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">
                  Cancel
                </button>
                <button
                  disabled={picked.size === 0}
                  onClick={() =>
                    onCreate([...picked].map((i) => suggestions[i]))
                  }
                  className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
                >
                  Create {picked.size} task{picked.size === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function toFriendly(e: Error): string {
  const msg = e.message;
  if (msg.includes("anthropic_api_key_missing")) {
    return "Set ANTHROPIC_API_KEY on the backend to enable AI features.";
  }
  if (msg.includes("ai_invalid_json")) {
    return "The model returned an unparseable response. Try again.";
  }
  if (msg.includes("ai_no_text_response")) {
    return "The model returned no content. Try again or rephrase the input.";
  }
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}

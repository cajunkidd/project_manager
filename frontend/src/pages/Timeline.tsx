import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Project, Task } from "../lib/types";
import { useTaskOpener } from "../lib/openTask";

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 36;
const LEFT_GUTTER = 220;

export default function Timeline() {
  const { open: openTask } = useTaskOpener();
  const [projectId, setProjectId] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-all"],
    queryFn: () => api.get<Project[]>("/projects"),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["timeline-tasks", projectId],
    queryFn: () =>
      projectId
        ? api.get<Task[]>(`/projects/${projectId}/tasks`)
        : api.get<Task[]>("/tasks"),
  });

  const dated = useMemo(
    () =>
      tasks
        .filter((t) => t.startDate || t.dueDate)
        .map((t) => {
          const start = t.startDate
            ? new Date(t.startDate)
            : t.dueDate
            ? new Date(t.dueDate)
            : null;
          const end = t.dueDate
            ? new Date(t.dueDate)
            : t.startDate
            ? new Date(t.startDate)
            : null;
          return { task: t, start: start!, end: end! };
        })
        .filter((t) => t.start && t.end)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [tasks],
  );

  const window = useMemo(() => {
    if (dated.length === 0) {
      const now = startOfDay(new Date());
      return { start: now, end: addDays(now, 30) };
    }
    let min = dated[0].start.getTime();
    let max = dated[0].end.getTime();
    for (const t of dated) {
      min = Math.min(min, t.start.getTime());
      max = Math.max(max, t.end.getTime());
    }
    // Pad with 2 days each side; ensure today is in view.
    const today = startOfDay(new Date()).getTime();
    min = Math.min(min, today) - 2 * DAY_MS;
    max = Math.max(max, today) + 2 * DAY_MS;
    return { start: new Date(startOfDay(new Date(min))), end: new Date(addDays(startOfDay(new Date(max)), 1)) };
  }, [dated]);

  const totalDays = Math.max(
    1,
    Math.ceil((window.end.getTime() - window.start.getTime()) / DAY_MS),
  );
  const dayWidth = Math.max(20, Math.min(48, 1100 / totalDays));
  const chartWidth = totalDays * dayWidth;
  const today = startOfDay(new Date());
  const todayX =
    LEFT_GUTTER +
    Math.round(((today.getTime() - window.start.getTime()) / DAY_MS) * dayWidth);

  const months = monthTicks(window.start, window.end);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Timeline</h1>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-3 overflow-auto">
        {dated.length === 0 ? (
          <div className="text-sm text-slate-500 p-6 text-center">
            No tasks with start or due dates in this view. Set dates on tasks
            (via the drawer) to see them on the timeline.
          </div>
        ) : (
          <svg
            width={LEFT_GUTTER + chartWidth + 16}
            height={HEADER_HEIGHT + dated.length * ROW_HEIGHT + 8}
            className="font-sans"
          >
            {/* Month header */}
            {months.map((m, i) => {
              const x = LEFT_GUTTER + (offsetDays(window.start, m.start) * dayWidth);
              const w = m.days * dayWidth;
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={0}
                    width={w}
                    height={HEADER_HEIGHT}
                    fill={i % 2 === 0 ? "#f8fafc" : "#f1f5f9"}
                  />
                  <text
                    x={x + 6}
                    y={HEADER_HEIGHT - 12}
                    fontSize="11"
                    fill="#475569"
                    fontWeight={600}
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}

            {/* Today line */}
            <line
              x1={todayX}
              y1={0}
              x2={todayX}
              y2={HEADER_HEIGHT + dated.length * ROW_HEIGHT}
              stroke="#dc2626"
              strokeDasharray="3,3"
            />
            <text x={todayX + 4} y={12} fontSize="10" fill="#dc2626">
              today
            </text>

            {/* Rows */}
            {dated.map((d, i) => {
              const y = HEADER_HEIGHT + i * ROW_HEIGHT;
              const x =
                LEFT_GUTTER +
                offsetDays(window.start, d.start) * dayWidth;
              const dur = Math.max(1, daysBetween(d.start, d.end) + 1);
              const w = dur * dayWidth;
              const overdue =
                d.task.status !== "done" &&
                d.task.status !== "cancelled" &&
                d.end < today;
              const done = d.task.status === "done";
              const fill = done
                ? "#10b981"
                : overdue
                ? "#f43f5e"
                : d.task.priority === "urgent"
                ? "#fb923c"
                : "#3b82f6";
              return (
                <g
                  key={d.task.id}
                  className="cursor-pointer"
                  onClick={() => openTask(d.task.id)}
                >
                  {/* Row hover background */}
                  <rect
                    x={0}
                    y={y}
                    width={LEFT_GUTTER + chartWidth}
                    height={ROW_HEIGHT}
                    fill={i % 2 === 0 ? "transparent" : "#f8fafc"}
                  />
                  {/* Task title */}
                  <text
                    x={10}
                    y={y + ROW_HEIGHT / 2 + 4}
                    fontSize="12"
                    fill="#0f172a"
                  >
                    {clip(d.task.title, 28)}
                  </text>
                  {/* Bar */}
                  <rect
                    x={x}
                    y={y + 6}
                    width={w}
                    height={ROW_HEIGHT - 12}
                    rx={4}
                    fill={fill}
                    opacity={done ? 0.6 : 0.9}
                  />
                  <text
                    x={x + 6}
                    y={y + ROW_HEIGHT / 2 + 4}
                    fontSize="11"
                    fill="white"
                    fontWeight={500}
                  >
                    {clip(d.task.assignedTo?.displayName ?? "", 16)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
        <Legend color="#3b82f6" label="In progress" />
        <Legend color="#fb923c" label="Urgent" />
        <Legend color="#f43f5e" label="Overdue" />
        <Legend color="#10b981" label="Done" />
        <span>· Click a bar to open the task drawer.</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}
function offsetDays(start: Date, d: Date) {
  return Math.round((d.getTime() - start.getTime()) / DAY_MS);
}
function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

interface MonthTick {
  start: Date;
  days: number;
  label: string;
}
function monthTicks(start: Date, end: Date): MonthTick[] {
  const out: MonthTick[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  if (cursor < start) cursor = new Date(start);
  while (cursor < end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const segEnd = monthEnd < end ? monthEnd : end;
    const days = Math.max(1, daysBetween(cursor, segEnd));
    out.push({
      start: new Date(cursor),
      days,
      label: cursor.toLocaleString(undefined, {
        month: "short",
        year: "2-digit",
      }),
    });
    cursor = monthEnd;
  }
  return out;
}

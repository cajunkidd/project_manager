import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { projectsApi, tasksApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { STATUS_COLORS } from '@/lib/utils';
import type { Project, Task } from '@/types';

const DAY_MS = 86_400_000;
const COL_W = 36;
const ROW_H = 36;
const LABEL_W = 220;

function addDays(date: Date, n: number) {
  return new Date(date.getTime() + n * DAY_MS);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysSpan(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
}

const STATUS_BAR_COLOR: Record<string, string> = {
  not_started: '#94a3b8',
  active: '#3b82f6',
  backlog: '#94a3b8',
  to_do: '#60a5fa',
  in_progress: '#f59e0b',
  waiting: '#fb923c',
  review: '#a78bfa',
  done: '#22c55e',
  completed: '#22c55e',
  on_hold: '#fb923c',
  cancelled: '#f87171',
};

interface GanttRow {
  id: string;
  label: string;
  type: 'project' | 'task';
  status: string;
  start: Date | null;
  end: Date | null;
  projectId?: string;
  indent: number;
}

export default function Gantt() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [viewStart, setViewStart] = useState<Date>(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [numDays, setNumDays] = useState(42);
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, t] = await Promise.all([
          projectsApi.list(selectedProject ? undefined : undefined),
          tasksApi.list(selectedProject ? { projectId: selectedProject } : {}),
        ]);
        setProjects(p);
        setTasks(t);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedProject]);

  const viewEnd = addDays(viewStart, numDays);

  const rows: GanttRow[] = [];
  const filteredProjects = selectedProject
    ? projects.filter((p) => p.id === selectedProject)
    : projects;

  for (const project of filteredProjects) {
    rows.push({
      id: project.id,
      label: project.name,
      type: 'project',
      status: project.status,
      start: project.startDate ? new Date(project.startDate) : null,
      end: project.dueDate ? new Date(project.dueDate) : null,
      indent: 0,
    });

    const projectTasks = tasks.filter((t) => t.project?.id === project.id);
    for (const task of projectTasks) {
      rows.push({
        id: task.id,
        label: task.title,
        type: 'task',
        status: task.status,
        start: task.startDate ? new Date(task.startDate) : null,
        end: task.dueDate ? new Date(task.dueDate) : null,
        projectId: project.id,
        indent: 1,
      });
    }
  }

  const unassigned = tasks.filter((t) => !t.project);
  if (unassigned.length > 0 && !selectedProject) {
    rows.push({ id: 'unassigned', label: 'Unassigned Tasks', type: 'project', status: '', start: null, end: null, indent: 0 });
    for (const task of unassigned) {
      rows.push({
        id: task.id, label: task.title, type: 'task', status: task.status,
        start: task.startDate ? new Date(task.startDate) : null,
        end: task.dueDate ? new Date(task.dueDate) : null,
        indent: 1,
      });
    }
  }

  const svgWidth = LABEL_W + numDays * COL_W;
  const svgHeight = Math.max((rows.length + 1) * ROW_H + 40, 200);

  const xForDate = (date: Date) => {
    const days = daysSpan(viewStart, date);
    return LABEL_W + days * COL_W;
  };

  const today = startOfDay(new Date());
  const todayX = xForDate(today);

  const days: Date[] = [];
  for (let i = 0; i < numDays; i++) days.push(addDays(viewStart, i));

  const monthGroups: { label: string; x: number; width: number }[] = [];
  let lastMonth = -1;
  days.forEach((d, i) => {
    const m = d.getMonth();
    if (m !== lastMonth) {
      const x = LABEL_W + i * COL_W;
      if (monthGroups.length > 0) monthGroups[monthGroups.length - 1].width = x - monthGroups[monthGroups.length - 1].x;
      monthGroups.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), x, width: 0 });
      lastMonth = m;
    }
  });
  if (monthGroups.length > 0) {
    const lastX = LABEL_W + numDays * COL_W;
    monthGroups[monthGroups.length - 1].width = lastX - monthGroups[monthGroups.length - 1].x;
  }

  const navigate = (dir: number) => setViewStart((d) => addDays(d, dir * 7));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Timeline</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(numDays)} onValueChange={(v) => setNumDays(parseInt(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="14">2 weeks</SelectItem>
              <SelectItem value="28">4 weeks</SelectItem>
              <SelectItem value="42">6 weeks</SelectItem>
              <SelectItem value="84">12 weeks</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => setViewStart(() => { const d = startOfDay(new Date()); d.setDate(d.getDate() - 7); return d; })}>Today</Button>
            <Button size="icon" variant="outline" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-auto">
          <svg ref={svgRef} width={svgWidth} height={svgHeight} className="font-sans">
            {/* Month headers */}
            <rect x={0} y={0} width={svgWidth} height={20} fill="#f8fafc" />
            {monthGroups.map((mg) => (
              <g key={mg.x}>
                <text x={mg.x + 6} y={14} fontSize={11} fill="#64748b" fontWeight={600}>{mg.label}</text>
                <line x1={mg.x} y1={0} x2={mg.x} y2={svgHeight} stroke="#e2e8f0" />
              </g>
            ))}

            {/* Day headers */}
            <rect x={0} y={20} width={svgWidth} height={20} fill="#f1f5f9" />
            {days.map((d, i) => {
              const x = LABEL_W + i * COL_W;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = d.toDateString() === today.toDateString();
              return (
                <g key={i}>
                  {isWeekend && <rect x={x} y={40} width={COL_W} height={svgHeight - 40} fill="#f8fafc" />}
                  <text
                    x={x + COL_W / 2} y={33}
                    fontSize={10}
                    textAnchor="middle"
                    fill={isToday ? '#2563eb' : isWeekend ? '#94a3b8' : '#64748b'}
                    fontWeight={isToday ? 700 : 400}
                  >
                    {d.getDate()}
                  </text>
                  <line x1={x} y1={20} x2={x} y2={svgHeight} stroke="#e2e8f0" strokeWidth={0.5} />
                </g>
              );
            })}

            {/* Label column header */}
            <rect x={0} y={0} width={LABEL_W} height={40} fill="#f1f5f9" />
            <text x={12} y={26} fontSize={11} fill="#64748b" fontWeight={600}>Task / Project</text>
            <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgHeight} stroke="#cbd5e1" />

            {/* Rows */}
            {rows.map((row, ri) => {
              const y = 40 + ri * ROW_H;
              const isProject = row.type === 'project';
              const barColor = STATUS_BAR_COLOR[row.status] ?? '#94a3b8';
              const hasBar = row.start && row.end;
              const barX = hasBar ? Math.max(xForDate(row.start!), LABEL_W) : 0;
              const barEndX = hasBar ? Math.min(xForDate(row.end!), svgWidth) : 0;
              const barW = hasBar ? Math.max(barEndX - barX, 6) : 0;

              return (
                <g key={row.id}>
                  <rect x={0} y={y} width={svgWidth} height={ROW_H} fill={ri % 2 === 0 ? '#fff' : '#fafafa'} />
                  <line x1={0} y1={y + ROW_H} x2={svgWidth} y2={y + ROW_H} stroke="#f1f5f9" />

                  {/* Label */}
                  <foreignObject x={4 + row.indent * 16} y={y + 4} width={LABEL_W - 8 - row.indent * 16} height={ROW_H - 8}>
                    <div style={{ fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {isProject ? (
                        <strong style={{ color: '#1e293b' }}>
                          <a href={`/projects/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {row.label}
                          </a>
                        </strong>
                      ) : (
                        <a href={`/tasks/${row.id}`} style={{ textDecoration: 'none', color: '#475569' }}>
                          {row.label}
                        </a>
                      )}
                    </div>
                  </foreignObject>

                  {/* Bar */}
                  {hasBar && barW > 0 && (
                    <g>
                      <rect
                        x={barX}
                        y={y + (isProject ? 8 : 10)}
                        width={barW}
                        height={isProject ? ROW_H - 16 : ROW_H - 20}
                        rx={3}
                        fill={barColor}
                        opacity={isProject ? 0.85 : 0.7}
                      />
                    </g>
                  )}

                  {/* No-date indicator */}
                  {!hasBar && (
                    <text x={LABEL_W + 8} y={y + ROW_H / 2 + 4} fontSize={10} fill="#94a3b8">
                      — no dates set —
                    </text>
                  )}
                </g>
              );
            })}

            {/* Today line */}
            {todayX >= LABEL_W && todayX <= svgWidth && (
              <g>
                <line x1={todayX} y1={40} x2={todayX} y2={svgHeight} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" />
                <circle cx={todayX} cy={42} r={4} fill="#2563eb" />
              </g>
            )}
          </svg>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
          {Object.entries(STATUS_BAR_COLOR).slice(0, 8).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="capitalize">{status.replace(/_/g, ' ')}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-blue-500" style={{ borderTop: '2px dashed #2563eb' }} />
            <span>Today</span>
          </div>
        </div>
      )}
    </div>
  );
}

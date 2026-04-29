import { useEffect, useState, useCallback } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import { tasksApi, projectsApi, usersApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriorityBadge } from '@/components/StatusBadge';
import { formatDate, isOverdue, STATUS_LABELS } from '@/lib/utils';
import type { Task, Project, User } from '@/types';

const COLUMNS = ['backlog', 'to_do', 'in_progress', 'waiting', 'review', 'done'] as const;

const COLUMN_COLORS: Record<string, string> = {
  backlog: 'bg-slate-50 border-slate-200',
  to_do: 'bg-blue-50 border-blue-200',
  in_progress: 'bg-yellow-50 border-yellow-200',
  waiting: 'bg-orange-50 border-orange-200',
  review: 'bg-purple-50 border-purple-200',
  done: 'bg-green-50 border-green-200',
};

function TaskCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <div
      className={`rounded-lg border bg-white p-3 shadow-sm select-none ${isDragging ? 'opacity-50' : ''} ${overdue ? 'border-l-4 border-l-red-500' : ''}`}
    >
      <Link to={`/tasks/${task.id}`} className="text-sm font-medium hover:underline line-clamp-2">
        {task.title}
      </Link>
      {task.project && (
        <p className="mt-1 text-xs text-muted-foreground truncate">{task.project.name}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
        <div className="text-right">
          {task.assignee && (
            <p className="text-xs text-muted-foreground">{task.assignee.displayName}</p>
          )}
          {task.dueDate && (
            <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
              {formatDate(task.dueDate)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
}

function Column({ status, tasks }: { status: string; tasks: Task[] }) {
  return (
    <div className={`flex flex-col rounded-lg border p-3 min-h-[200px] ${COLUMN_COLORS[status]}`} style={{ minWidth: 220, maxWidth: 280, flex: '0 0 250px' }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium border">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {tasks.map((task) => <SortableTaskCard key={task.id} task={task} />)}
        </div>
      </SortableContext>
    </div>
  );
}

export default function Board() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    try {
      const [t, p, u] = await Promise.all([
        tasksApi.list({
          ...(projectFilter && { projectId: projectFilter }),
          ...(userFilter && { assignedTo: userFilter }),
          ...(priorityFilter && { priority: priorityFilter }),
        }),
        projectsApi.list(),
        usersApi.list(),
      ]);
      setTasks(t);
      setProjects(p);
      setUsers(u);
    } finally {
      setLoading(false);
    }
  }, [projectFilter, userFilter, priorityFilter]);

  useEffect(() => { load(); }, [load]);

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col] = tasks.filter((t) => t.status === col).sort((a, b) => a.sortOrder - b.sortOrder);
    return acc;
  }, {} as Record<string, Task[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overTask = tasks.find((t) => t.id === over.id);
    const newStatus = overTask?.status ?? (COLUMNS.find((c) => c === over.id) ?? activeTask.status);

    if (newStatus === activeTask.status) return;

    setTasks((prev) => prev.map((t) => t.id === active.id ? { ...t, status: newStatus } : t));
    try {
      await tasksApi.updateStatus(activeTask.id, newStatus);
    } catch {
      load();
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Board</h1>

      <div className="flex gap-3 flex-wrap">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All assignees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All assignees</SelectItem>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All priorities</SelectItem>
            {['low', 'normal', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <Column key={col} status={col} tasks={tasksByStatus[col]} />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

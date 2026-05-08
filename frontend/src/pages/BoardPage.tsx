import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { PriorityBadge } from '../components/PriorityBadge';
import type { Project, Task, TaskStatus } from '../types';
import { TASK_STATUS_ORDER, formatDate, isOverdue, taskStatusLabel } from '../utils/format';

export function BoardPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') ?? undefined;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => undefined);
  }, []);

  useEffect(() => {
    tasksApi
      .list({ projectId })
      .then(setTasks)
      .catch((err) => setError(err.message));
  }, [projectId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      to_do: [],
      in_progress: [],
      waiting: [],
      review: [],
      done: [],
      cancelled: [],
    };
    for (const t of tasks) {
      const column = (grouped[t.status as TaskStatus] ?? grouped.backlog) as Task[];
      column.push(t);
    }
    for (const status of TASK_STATUS_ORDER) {
      grouped[status].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return grouped;
  }, [tasks]);

  function findContainer(id: string): TaskStatus | null {
    if ((TASK_STATUS_ORDER as readonly string[]).includes(id)) return id as TaskStatus;
    const task = tasks.find((t) => t.id === id);
    return (task?.status as TaskStatus) ?? null;
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const fromContainer = findContainer(String(active.id));
    const toContainer = findContainer(String(over.id));
    if (!fromContainer || !toContainer) return;

    const before = tasks;
    const movedId = String(active.id);
    const movedTask = tasks.find((t) => t.id === movedId);
    if (!movedTask) return;

    let next: Task[];
    if (fromContainer === toContainer) {
      const ids = columns[fromContainer].map((t) => t.id);
      const oldIndex = ids.indexOf(movedId);
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(columns[fromContainer], oldIndex, newIndex);
      const newSortOrders = new Map(reordered.map((t, idx) => [t.id, idx]));
      next = tasks.map((t) =>
        newSortOrders.has(t.id) ? { ...t, sortOrder: newSortOrders.get(t.id)! } : t,
      );
    } else {
      const updatedMoved = { ...movedTask, status: toContainer };
      const targetCol = columns[toContainer].filter((t) => t.id !== movedId);
      let insertIndex = targetCol.length;
      const overIdx = targetCol.findIndex((t) => t.id === String(over.id));
      if (overIdx !== -1) insertIndex = overIdx;
      targetCol.splice(insertIndex, 0, updatedMoved);
      const newSortOrders = new Map(targetCol.map((t, idx) => [t.id, idx]));
      next = tasks.map((t) => {
        if (t.id === movedId) return { ...t, status: toContainer, sortOrder: newSortOrders.get(t.id)! };
        if (newSortOrders.has(t.id)) return { ...t, sortOrder: newSortOrders.get(t.id)! };
        return t;
      });
    }

    setTasks(next);

    const items = next
      .filter((t) => t.status === toContainer || t.status === fromContainer)
      .map((t) => ({ id: t.id, status: t.status as TaskStatus, sortOrder: t.sortOrder }));
    try {
      await tasksApi.reorder(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setTasks(before);
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  return (
    <div className="col">
      <div className="page-header">
        <h1>Board</h1>
        <div className="row">
          <select
            value={projectId ?? ''}
            onChange={(e) => {
              const url = new URL(window.location.href);
              if (e.target.value) url.searchParams.set('projectId', e.target.value);
              else url.searchParams.delete('projectId');
              window.history.pushState({}, '', url);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="kanban">
          {TASK_STATUS_ORDER.map((status) => (
            <Column key={status} status={status} tasks={columns[status]} />
          ))}
        </div>
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, tasks }: { status: TaskStatus; tasks: Task[] }) {
  return (
    <div className="kanban-column" data-status={status}>
      <h3>
        <span>{taskStatusLabel(status)}</span>
        <span>{tasks.length}</span>
      </h3>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((t) => (
          <SortableCard key={t.id} task={t} />
        ))}
      </SortableContext>
    </div>
  );
}

function SortableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card${isDragging ? ' dragging' : ''}`}
    >
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <div className={`kanban-card${dragging ? ' dragging' : ''}`} style={{ cursor: 'grab' }}>
      <Link to={`/tasks/${task.id}`} style={{ fontWeight: 500 }}>
        {task.title}
      </Link>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <PriorityBadge priority={task.priority} />
        {task.project ? <span className="badge">{task.project.name}</span> : null}
        {isOverdue(task.dueDate, task.status) ? (
          <span className="badge overdue">{formatDate(task.dueDate)}</span>
        ) : task.dueDate ? (
          <span className="badge">{formatDate(task.dueDate)}</span>
        ) : null}
      </div>
      {task.assignedTo ? (
        <div className="muted" style={{ fontSize: 12 }}>
          {task.assignedTo.displayName}
        </div>
      ) : null}
    </div>
  );
}

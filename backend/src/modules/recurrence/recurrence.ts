import type { Task } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { activityService } from '../activity/activity.service';

export type Recurrence = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export const RECURRENCE_VALUES: Recurrence[] = ['daily', 'weekly', 'biweekly', 'monthly'];

export function isRecurrence(value: unknown): value is Recurrence {
  return typeof value === 'string' && (RECURRENCE_VALUES as string[]).includes(value);
}

export function advanceDate(from: Date, recurrence: Recurrence): Date {
  const next = new Date(from);
  switch (recurrence) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'biweekly':
      next.setUTCDate(next.getUTCDate() + 14);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }
  return next;
}

async function createNextOccurrence(task: Task, actorId?: string | null): Promise<Task | null> {
  if (!task.recurrence || !isRecurrence(task.recurrence)) return null;

  const base = task.dueDate ?? task.completedAt ?? new Date();
  const nextDueDate = advanceDate(base, task.recurrence);

  if (task.recurrenceEndsAt && nextDueDate > task.recurrenceEndsAt) return null;

  let nextStartDate: Date | null = null;
  if (task.startDate && task.dueDate) {
    const offsetMs = task.dueDate.getTime() - task.startDate.getTime();
    nextStartDate = new Date(nextDueDate.getTime() - offsetMs);
  }

  const created = await prisma.task.create({
    data: {
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      title: task.title,
      description: task.description,
      status: 'to_do',
      priority: task.priority,
      assignedToId: task.assignedToId,
      createdById: actorId ?? task.createdById ?? null,
      startDate: nextStartDate,
      dueDate: nextDueDate,
      sortOrder: task.sortOrder,
      recurrence: task.recurrence,
      recurrenceEndsAt: task.recurrenceEndsAt,
      recurrenceParentId: task.recurrenceParentId ?? task.id,
    },
  });

  await activityService.log({
    entityType: 'task',
    entityId: created.id,
    action: 'recurrence_spawned',
    newValue: {
      sourceTaskId: task.id,
      recurrence: task.recurrence,
      dueDate: nextDueDate.toISOString(),
    },
    userId: actorId ?? null,
  });

  await eventBus.emit({ type: 'task.created', task: created, actorId: actorId ?? null });
  if (created.assignedToId && created.assignedToId !== actorId) {
    await eventBus.emit({
      type: 'task.assigned',
      task: created,
      assigneeId: created.assignedToId,
      actorId: actorId ?? null,
    });
  }
  return created;
}

let registered = false;

export function registerRecurrenceEngine(): void {
  if (registered) return;
  registered = true;
  eventBus.on('task.status_changed', async (event) => {
    if (event.toStatus !== 'done') return;
    if (event.fromStatus === 'done') return;
    await createNextOccurrence(event.task, event.actorId ?? null);
  });
}

export const recurrenceService = {
  createNextOccurrence,
  advanceDate,
};

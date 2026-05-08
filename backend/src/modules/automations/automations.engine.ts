import { prisma } from '../../db/prisma';
import { eventBus, type DomainEvent } from '../../events/bus';
import { notificationsService } from '../notifications/notifications.service';
import { tasksService } from '../tasks/tasks.service';
import {
  automationsService,
  type AutomationAction,
  type AutomationCondition,
  type TriggerType,
} from './automations.service';

let registered = false;

function getEntityForEvent(event: DomainEvent): Record<string, unknown> | null {
  switch (event.type) {
    case 'task.created':
    case 'task.updated':
    case 'task.assigned':
    case 'task.status_changed':
      return event.task as unknown as Record<string, unknown>;
    case 'comment.created':
      return { ...event } as unknown as Record<string, unknown>;
    case 'form.submitted':
      return event.submission as unknown as Record<string, unknown>;
    default:
      return null;
  }
}

function matches(conditions: AutomationCondition[], entity: Record<string, unknown>): boolean {
  if (!conditions.length) return true;
  return conditions.every((c) => {
    const value = entity[c.field];
    if ('equals' in c && c.equals !== undefined) return value === c.equals;
    if ('notEquals' in c && c.notEquals !== undefined) return value !== c.notEquals;
    return true;
  });
}

async function runAction(
  action: AutomationAction,
  event: DomainEvent,
  entity: Record<string, unknown>,
): Promise<void> {
  switch (action.type) {
    case 'send_notification': {
      const userId = (action.params.userId as string | undefined) ?? (entity.assignedToId as string | undefined);
      if (!userId) return;
      await notificationsService.create({
        userId,
        type: 'automation',
        title: (action.params.title as string) ?? 'Automation',
        message: (action.params.message as string) ?? `${event.type} triggered`,
        entityType: (entity as { id?: string }).id ? 'task' : null,
        entityId: (entity as { id?: string }).id ?? null,
      });
      return;
    }
    case 'assign_user': {
      const taskId = entity.id as string | undefined;
      const userId = action.params.userId as string | undefined;
      if (!taskId || !userId) return;
      await tasksService.update(taskId, { assignedToId: userId });
      return;
    }
    case 'change_status': {
      const taskId = entity.id as string | undefined;
      const status = action.params.status as string | undefined;
      if (!taskId || !status) return;
      await tasksService.update(taskId, { status });
      return;
    }
    case 'change_priority': {
      const taskId = entity.id as string | undefined;
      const priority = action.params.priority as string | undefined;
      if (!taskId || !priority) return;
      await tasksService.update(taskId, { priority });
      return;
    }
    case 'add_comment': {
      const taskId = entity.id as string | undefined;
      const body = action.params.body as string | undefined;
      const userId = (action.params.userId as string | undefined) ?? null;
      if (!taskId || !body) return;
      await prisma.comment.create({
        data: { taskId, projectId: null, userId: userId ?? '', body },
      }).catch(() => undefined);
      return;
    }
    default:
      return;
  }
}

const TRIGGER_MAP: Record<DomainEvent['type'], TriggerType | null> = {
  'task.created': 'task_created',
  'task.updated': 'task_updated',
  'task.assigned': 'task_updated',
  'task.status_changed': 'task_status_changed',
  'project.created': null,
  'project.updated': null,
  'comment.created': 'comment_created',
  'form.submitted': 'form_submitted',
};

export function registerAutomationEngine(): void {
  if (registered) return;
  registered = true;

  for (const eventType of Object.keys(TRIGGER_MAP) as DomainEvent['type'][]) {
    const trigger = TRIGGER_MAP[eventType];
    if (!trigger) continue;

    eventBus.on(eventType, async (event) => {
      const entity = getEntityForEvent(event);
      if (!entity) return;
      const rules = await automationsService.findActiveByTrigger(trigger);
      for (const rule of rules) {
        if (!matches(rule.parsedConditions, entity)) continue;
        for (const action of rule.parsedActions) {
          await runAction(action, event, entity);
        }
      }
    });
  }
}

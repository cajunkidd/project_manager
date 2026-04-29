import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationsService, AutomationCondition, AutomationAction } from './automations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

export interface AutomationContext {
  task?: any;
  oldTask?: any;
  project?: any;
  triggeredBy?: string;
}

@Injectable()
export class AutomationEngine {
  private logger = new Logger(AutomationEngine.name);

  constructor(
    private prisma: PrismaService,
    private automations: AutomationsService,
    private notifications: NotificationsService,
    private activityLogs: ActivityLogsService,
  ) {}

  async trigger(triggerType: string, context: AutomationContext) {
    const rules = await this.automations.findActiveByTrigger(triggerType);
    for (const rule of rules) {
      try {
        const conditions = (rule.conditions as unknown as AutomationCondition[]) ?? [];
        if (this.evaluateConditions(conditions, context)) {
          const actions = (rule.actions as unknown as AutomationAction[]) ?? [];
          await this.executeActions(actions, context, rule.id);
        }
      } catch (err) {
        this.logger.error(`Rule ${rule.id} (${rule.name}) failed: ${err.message}`);
      }
    }
  }

  private evaluateConditions(conditions: AutomationCondition[], ctx: AutomationContext): boolean {
    if (conditions.length === 0) return true;
    return conditions.every((cond) => this.evaluateCondition(cond, ctx));
  }

  private evaluateCondition(cond: AutomationCondition, ctx: AutomationContext): boolean {
    const task = ctx.task ?? {};
    const oldTask = ctx.oldTask ?? {};

    if (cond.operator === 'changed_to') {
      return task[cond.field] === cond.value && oldTask[cond.field] !== cond.value;
    }
    if (cond.operator === 'changed_from') {
      return oldTask[cond.field] === cond.value && task[cond.field] !== cond.value;
    }

    const fieldValue = this.getFieldValue(task, cond.field);
    switch (cond.operator) {
      case 'equals': return fieldValue === cond.value;
      case 'not_equals': return fieldValue !== cond.value;
      case 'in': return Array.isArray(cond.value) && cond.value.includes(fieldValue);
      default: return false;
    }
  }

  private getFieldValue(task: any, field: string): any {
    if (field === 'assignedTo') return task.assignedTo ?? task.assignee?.id;
    if (field === 'projectId') return task.projectId ?? task.project?.id;
    return task[field];
  }

  private async executeActions(actions: AutomationAction[], ctx: AutomationContext, ruleId: string) {
    for (const action of actions) {
      await this.executeAction(action, ctx, ruleId);
    }
  }

  private async executeAction(action: AutomationAction, ctx: AutomationContext, ruleId: string) {
    const task = ctx.task;
    if (!task) return;

    switch (action.type) {
      case 'notify': {
        const userId = action.params.userId === '$assignee'
          ? (task.assignedTo ?? task.assignee?.id)
          : action.params.userId;
        if (!userId) return;
        await this.notifications.create({
          userId,
          title: action.params.title ?? 'Automation Notification',
          message: this.interpolate(action.params.message ?? 'A task triggered an automation.', task),
          type: 'automation',
          entityType: 'task',
          entityId: task.id,
        });
        break;
      }
      case 'change_status': {
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            status: action.params.status,
            ...(action.params.status === 'done' ? { completedAt: new Date() } : {}),
          },
        });
        await this.activityLogs.log('task', task.id, 'auto_status_changed',
          { status: task.status }, { status: action.params.status, ruleId }, null);
        break;
      }
      case 'assign': {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { assignedTo: action.params.userId },
        });
        await this.activityLogs.log('task', task.id, 'auto_assigned',
          { assignedTo: task.assignedTo }, { assignedTo: action.params.userId, ruleId }, null);
        if (action.params.userId) {
          await this.notifications.create({
            userId: action.params.userId,
            title: 'Task Auto-Assigned',
            message: `An automation assigned you to: ${task.title}`,
            type: 'task_assigned',
            entityType: 'task',
            entityId: task.id,
          });
        }
        break;
      }
      case 'set_priority': {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { priority: action.params.priority },
        });
        await this.activityLogs.log('task', task.id, 'auto_priority_changed',
          { priority: task.priority }, { priority: action.params.priority, ruleId }, null);
        break;
      }
      case 'create_subtask': {
        await this.prisma.task.create({
          data: {
            title: this.interpolate(action.params.title ?? 'Auto-created subtask', task),
            description: action.params.description ?? null,
            parentTaskId: task.id,
            projectId: task.projectId ?? task.project?.id ?? null,
            priority: action.params.priority ?? 'normal',
            assignedTo: action.params.assignedTo === '$assignee'
              ? (task.assignedTo ?? task.assignee?.id ?? null)
              : action.params.assignedTo ?? null,
            status: 'to_do',
          },
        });
        break;
      }
      case 'add_comment': {
        await this.prisma.comment.create({
          data: {
            taskId: task.id,
            body: this.interpolate(action.params.body ?? '', task),
            userId: null,
          },
        });
        break;
      }
    }
  }

  private interpolate(template: string, task: any): string {
    return template
      .replace(/\{\{title\}\}/g, task.title ?? '')
      .replace(/\{\{status\}\}/g, task.status ?? '')
      .replace(/\{\{priority\}\}/g, task.priority ?? '')
      .replace(/\{\{assignee\}\}/g, task.assignee?.displayName ?? 'Unassigned')
      .replace(/\{\{project\}\}/g, task.project?.name ?? '');
  }

  async runOverdueCheck() {
    const now = new Date();
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        status: { notIn: ['done', 'cancelled'] },
        dueDate: { lt: now },
      },
      include: {
        assignee: { select: { id: true, displayName: true } },
        project: { select: { id: true, name: true } },
      },
    });
    for (const task of overdueTasks) {
      await this.trigger('task.overdue', { task });
    }
    return { checked: overdueTasks.length };
  }
}

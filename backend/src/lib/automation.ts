import { prisma } from "../prisma";
import { logActivity } from "./activity";
import { notify } from "./notify";

export type AutomationTrigger =
  | "task_created"
  | "task_status_changed"
  | "comment_created"
  | "form_submitted";

interface TaskCtx {
  task: {
    id: string;
    projectId: string;
    status: string;
    priority: string;
    assignedToId: string | null;
    title: string;
  };
  oldStatus?: string;
}

interface CommentCtx {
  comment: {
    id: string;
    taskId: string | null;
    projectId: string | null;
    userId: string;
    body: string;
  };
}

interface FormCtx {
  formId: string;
  task: { id: string; projectId: string; assignedToId: string | null; title: string };
}

export type EventCtx =
  | ({ trigger: "task_created" } & TaskCtx)
  | ({ trigger: "task_status_changed" } & TaskCtx)
  | ({ trigger: "comment_created" } & CommentCtx)
  | ({ trigger: "form_submitted" } & FormCtx);

type Conditions = Record<string, unknown>;

export interface Action {
  type:
    | "send_notification"
    | "assign_user"
    | "change_status"
    | "change_priority"
    | "add_comment";
  userId?: string;
  message?: string;
  status?: string;
  priority?: string;
  body?: string;
}

function matches(conditions: Conditions | null, ctx: EventCtx): boolean {
  if (!conditions) return true;
  const checkKeys = (obj: Record<string, unknown>) =>
    Object.entries(conditions).every(([k, v]) => {
      if (v === undefined || v === null || v === "") return true;
      return obj[k] === v;
    });
  switch (ctx.trigger) {
    case "task_created":
    case "task_status_changed":
      return checkKeys(ctx.task as unknown as Record<string, unknown>);
    case "comment_created":
      return checkKeys(ctx.comment as unknown as Record<string, unknown>);
    case "form_submitted":
      return checkKeys({ formId: ctx.formId, projectId: ctx.task.projectId });
  }
}

async function resolveTask(ctx: EventCtx) {
  if (ctx.trigger === "comment_created") {
    if (!ctx.comment.taskId) return null;
    return prisma.task.findUnique({ where: { id: ctx.comment.taskId } });
  }
  return ctx.task as { id: string; title: string };
}

async function runAction(action: Action, ctx: EventCtx) {
  const task = await resolveTask(ctx);

  switch (action.type) {
    case "send_notification": {
      if (!action.userId) return;
      await notify({
        userId: action.userId,
        title: action.message?.slice(0, 80) ?? "Automation alert",
        message: action.message ?? `Triggered by ${ctx.trigger}`,
        type: "status_changed",
        entityType: task ? "task" : undefined,
        entityId: task?.id,
      });
      break;
    }
    case "assign_user": {
      if (!task || !action.userId) return;
      await prisma.task.update({
        where: { id: task.id },
        data: { assignedToId: action.userId },
      });
      await notify({
        userId: action.userId,
        title: "Assigned: " + task.title,
        message: "Assigned by automation rule.",
        type: "task_assigned",
        entityType: "task",
        entityId: task.id,
      });
      break;
    }
    case "change_status": {
      if (!task || !action.status) return;
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: action.status as never,
          completedAt: action.status === "done" ? new Date() : null,
        },
      });
      await logActivity({
        entityType: "task",
        entityId: task.id,
        action: "status_changed_by_automation",
        newValue: { status: action.status },
      });
      break;
    }
    case "change_priority": {
      if (!task || !action.priority) return;
      await prisma.task.update({
        where: { id: task.id },
        data: { priority: action.priority as never },
      });
      break;
    }
    case "add_comment": {
      if (!task || !action.body) return;
      const author = await prisma.task.findUnique({
        where: { id: task.id },
        select: { createdById: true },
      });
      if (!author?.createdById) return;
      await prisma.comment.create({
        data: { taskId: task.id, userId: author.createdById, body: action.body },
      });
      break;
    }
  }
}

export async function runAutomations(ctx: EventCtx) {
  const rules = await prisma.automationRule.findMany({
    where: { isActive: true, triggerType: ctx.trigger },
  });
  for (const r of rules) {
    if (!matches(r.conditions as Conditions | null, ctx)) continue;
    const actions = (r.actions as unknown as Action[]) ?? [];
    for (const a of actions) {
      try {
        await runAction(a, ctx);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("automation action failed", { rule: r.id, action: a.type, e });
      }
    }
  }
}

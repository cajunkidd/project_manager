import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { logActivity } from "../lib/activity";
import { notify } from "../lib/notify";
import { runAutomations } from "../lib/automation";
import { dispatchWebhook } from "../lib/webhooks";
import { appLink, sendEmailToUser } from "../lib/email";

export const tasksRouter = Router();

const taskStatus = z.enum([
  "backlog",
  "to_do",
  "in_progress",
  "waiting",
  "review",
  "done",
  "cancelled",
]);
const priority = z.enum(["low", "normal", "high", "urgent"]);

const createSchema = z.object({
  projectId: z.string().uuid(),
  parentTaskId: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: taskStatus.optional(),
  priority: priority.optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  createdById: z.string().uuid().optional().nullable(),
  startDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  dueDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();
const toDate = (v: string | null | undefined) => (v == null ? v : new Date(v));

tasksRouter.patch("/reorder", async (req, res) => {
  const { items } = z
    .object({
      items: z.array(
        z.object({
          id: z.string().uuid(),
          status: taskStatus,
          sortOrder: z.number().int(),
        }),
      ),
    })
    .parse(req.body);
  await prisma.$transaction(
    items.map((it) =>
      prisma.task.update({
        where: { id: it.id },
        data: { status: it.status, sortOrder: it.sortOrder },
      }),
    ),
  );
  res.json({ ok: true, count: items.length });
});

tasksRouter.get("/", async (req, res) => {
  const { projectId, status, assignedToId, priority: pr, dueBefore } = req.query;
  const tasks = await prisma.task.findMany({
    where: {
      ...(typeof projectId === "string" ? { projectId } : {}),
      ...(typeof status === "string" ? { status: status as never } : {}),
      ...(typeof assignedToId === "string" ? { assignedToId } : {}),
      ...(typeof pr === "string" ? { priority: pr as never } : {}),
      ...(typeof dueBefore === "string"
        ? { dueDate: { lte: new Date(dueBefore) } }
        : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  res.json(tasks);
});

tasksRouter.get("/:id/activity", async (req, res) => {
  const logs = await prisma.activityLog.findMany({
    where: { entityType: "task", entityId: req.params.id },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(logs);
});

tasksRouter.get("/:id", async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, displayName: true, email: true } },
      createdBy: { select: { id: true, displayName: true, email: true } },
      subtasks: {
        include: {
          assignedTo: { select: { id: true, displayName: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!task) throw new HttpError(404, "task_not_found");
  res.json(task);
});

tasksRouter.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const task = await prisma.task.create({
    data: {
      ...data,
      startDate: toDate(data.startDate ?? null),
      dueDate: toDate(data.dueDate ?? null),
    },
  });
  await logActivity({
    entityType: "task",
    entityId: task.id,
    action: "created",
    userId: data.createdById ?? null,
    newValue: task,
  });
  if (task.assignedToId && task.assignedToId !== data.createdById) {
    await notify({
      userId: task.assignedToId,
      title: "Assigned: " + task.title,
      message: "You were assigned a new task.",
      type: "task_assigned",
      entityType: "task",
      entityId: task.id,
    });
    void sendEmailToUser(task.assignedToId, {
      subject: `Assigned: ${task.title}`,
      text: `You were assigned a new task.\n\n${appLink(`/my-tasks?task=${task.id}`)}`,
    });
  }
  await runAutomations({ trigger: "task_created", task });
  dispatchWebhook("task_created", { task });
  res.status(201).json(task);
});

tasksRouter.patch("/:id", async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "task_not_found");
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...data,
      startDate: toDate(data.startDate ?? null) ?? undefined,
      dueDate: toDate(data.dueDate ?? null) ?? undefined,
      ...(data.status === "done" && before.status !== "done"
        ? { completedAt: new Date() }
        : {}),
      ...(data.status && data.status !== "done" ? { completedAt: null } : {}),
    },
  });
  await logActivity({
    entityType: "task",
    entityId: task.id,
    action: "updated",
    oldValue: before,
    newValue: task,
  });
  if (
    task.assignedToId &&
    task.assignedToId !== before.assignedToId
  ) {
    await notify({
      userId: task.assignedToId,
      title: "Assigned: " + task.title,
      message: "You were assigned this task.",
      type: "task_assigned",
      entityType: "task",
      entityId: task.id,
    });
    void sendEmailToUser(task.assignedToId, {
      subject: `Assigned: ${task.title}`,
      text: `You were assigned this task.\n\n${appLink(`/my-tasks?task=${task.id}`)}`,
    });
  }
  if (data.status && data.status !== before.status) {
    await runAutomations({
      trigger: "task_status_changed",
      task,
      oldStatus: before.status,
    });
  }
  dispatchWebhook("task_updated", { task, before });
  res.json(task);
});

tasksRouter.patch("/:id/status", async (req, res) => {
  const { status } = z.object({ status: taskStatus }).parse(req.body);
  const before = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "task_not_found");
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
    },
  });
  await logActivity({
    entityType: "task",
    entityId: task.id,
    action: "status_changed",
    oldValue: { status: before.status },
    newValue: { status: task.status },
  });
  if (status !== before.status) {
    await runAutomations({
      trigger: "task_status_changed",
      task,
      oldStatus: before.status,
    });
  }
  dispatchWebhook("task_updated", { task, before: { status: before.status } });
  res.json(task);
});

tasksRouter.delete("/:id", async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  await logActivity({
    entityType: "task",
    entityId: req.params.id,
    action: "deleted",
  });
  res.status(204).end();
});

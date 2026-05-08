import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireToken } from "../middleware/tokenAuth";
import { logActivity } from "../lib/activity";
import { notify } from "../lib/notify";
import { runAutomations } from "../lib/automation";
import { dispatchWebhook } from "../lib/webhooks";

export const externalRouter = Router();

externalRouter.use(requireToken);

externalRouter.get("/whoami", (req, res) => {
  res.json({ ok: true, tokenId: req.apiTokenId });
});

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z
    .enum(["backlog", "to_do", "in_progress", "waiting", "review", "done", "cancelled"])
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedToEmail: z.string().email().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

externalRouter.post("/tasks", async (req, res) => {
  const data = createTaskSchema.parse(req.body);
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new HttpError(404, "project_not_found");

  let assignedToId: string | null = null;
  if (data.assignedToEmail) {
    const u = await prisma.user.findUnique({
      where: { email: data.assignedToEmail.toLowerCase() },
    });
    if (!u) throw new HttpError(404, "assignee_not_found");
    assignedToId = u.id;
  }

  const task = await prisma.task.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      assignedToId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });
  await logActivity({
    entityType: "task",
    entityId: task.id,
    action: "created_via_api",
    newValue: { tokenId: req.apiTokenId },
  });
  if (assignedToId) {
    await notify({
      userId: assignedToId,
      title: "Assigned: " + task.title,
      message: "Created via API.",
      type: "task_assigned",
      entityType: "task",
      entityId: task.id,
    });
  }
  await runAutomations({ trigger: "task_created", task });
  dispatchWebhook("task_created", { task });
  res.status(201).json(task);
});

externalRouter.get("/tasks", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: {
      ...(typeof req.query.projectId === "string"
        ? { projectId: req.query.projectId }
        : {}),
      ...(typeof req.query.status === "string"
        ? { status: req.query.status as never }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  res.json(tasks);
});

externalRouter.get("/projects", async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
  });
  res.json(projects);
});

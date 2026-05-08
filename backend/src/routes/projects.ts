import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { logActivity } from "../lib/activity";
import { dispatchWebhook } from "../lib/webhooks";

export const projectsRouter = Router();

const projectStatus = z.enum([
  "not_started",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);
const priority = z.enum(["low", "normal", "high", "urgent"]);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  status: projectStatus.optional(),
  priority: priority.optional(),
  department: z.string().optional().nullable(),
  startDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  dueDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  createdById: z.string().uuid().optional().nullable(),
});

const updateSchema = createSchema.partial();

const toDate = (v: string | null | undefined) =>
  v == null ? v : new Date(v);

projectsRouter.get("/", async (req, res) => {
  const { status, ownerId, department, priority: pr } = req.query;
  const projects = await prisma.project.findMany({
    where: {
      ...(typeof status === "string" ? { status: status as never } : {}),
      ...(typeof ownerId === "string" ? { ownerId } : {}),
      ...(typeof department === "string" ? { department } : {}),
      ...(typeof pr === "string" ? { priority: pr as never } : {}),
    },
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(projects);
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
      createdBy: { select: { id: true, displayName: true, email: true } },
    },
  });
  if (!project) throw new HttpError(404, "project_not_found");
  res.json(project);
});

projectsRouter.get("/:id/tasks", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.id },
    include: {
      assignedTo: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json(tasks);
});

projectsRouter.get("/:id/activity", async (req, res) => {
  const logs = await prisma.activityLog.findMany({
    where: { entityType: "project", entityId: req.params.id },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(logs);
});

projectsRouter.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const project = await prisma.project.create({
    data: {
      ...data,
      startDate: toDate(data.startDate ?? null),
      dueDate: toDate(data.dueDate ?? null),
    },
  });
  await logActivity({
    entityType: "project",
    entityId: project.id,
    action: "created",
    userId: data.createdById ?? null,
    newValue: project,
  });
  dispatchWebhook("project_created", { project });
  res.status(201).json(project);
});

projectsRouter.patch("/:id", async (req, res) => {
  const data = updateSchema.parse(req.body);
  const before = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "project_not_found");
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...data,
      startDate: toDate(data.startDate ?? null) ?? undefined,
      dueDate: toDate(data.dueDate ?? null) ?? undefined,
      ...(data.status === "completed" && before.status !== "completed"
        ? { completedAt: new Date() }
        : {}),
    },
  });
  await logActivity({
    entityType: "project",
    entityId: project.id,
    action: "updated",
    oldValue: before,
    newValue: project,
  });
  dispatchWebhook("project_updated", { project, before });
  res.json(project);
});

projectsRouter.delete("/:id", async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  await logActivity({
    entityType: "project",
    entityId: req.params.id,
    action: "deleted",
  });
  res.status(204).end();
});

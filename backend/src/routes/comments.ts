import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { logActivity } from "../lib/activity";
import { notifyMentions } from "../lib/mentions";

export const commentsRouter = Router();

const createSchema = z
  .object({
    taskId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    userId: z.string().uuid(),
    body: z.string().min(1),
  })
  .refine((v) => v.taskId || v.projectId, {
    message: "taskId or projectId is required",
  });

commentsRouter.get("/", async (req, res) => {
  const { taskId, projectId } = req.query;
  const comments = await prisma.comment.findMany({
    where: {
      ...(typeof taskId === "string" ? { taskId } : {}),
      ...(typeof projectId === "string" ? { projectId } : {}),
    },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
});

commentsRouter.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const comment = await prisma.comment.create({ data });
  await logActivity({
    entityType: "comment",
    entityId: comment.id,
    action: "created",
    userId: data.userId,
    newValue: { taskId: data.taskId, projectId: data.projectId, body: data.body },
  });
  if (data.taskId) {
    await notifyMentions({
      body: data.body,
      authorId: data.userId,
      title: "You were mentioned in a task comment",
      entityType: "task",
      entityId: data.taskId,
    });
  } else if (data.projectId) {
    await notifyMentions({
      body: data.body,
      authorId: data.userId,
      title: "You were mentioned in a project comment",
      entityType: "project",
      entityId: data.projectId,
    });
  }
  res.status(201).json(comment);
});

commentsRouter.patch("/:id", async (req, res) => {
  const data = z.object({ body: z.string().min(1) }).parse(req.body);
  const before = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "comment_not_found");
  const comment = await prisma.comment.update({
    where: { id: req.params.id },
    data,
  });
  await logActivity({
    entityType: "comment",
    entityId: comment.id,
    action: "updated",
    oldValue: { body: before.body },
    newValue: { body: comment.body },
  });
  res.json(comment);
});

commentsRouter.delete("/:id", async (req, res) => {
  await prisma.comment.delete({ where: { id: req.params.id } });
  await logActivity({
    entityType: "comment",
    entityId: req.params.id,
    action: "deleted",
  });
  res.status(204).end();
});

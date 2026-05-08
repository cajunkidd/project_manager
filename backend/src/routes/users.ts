import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";

export const usersRouter = Router();

const upsertSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(["admin", "manager", "user", "viewer"]).optional(),
  department: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
});

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { displayName: "asc" } });
  res.json(users);
});

usersRouter.get("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw new HttpError(404, "user_not_found");
  res.json(user);
});

usersRouter.post("/", async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const user = await prisma.user.create({ data });
  res.status(201).json(user);
});

usersRouter.patch("/:id", async (req, res) => {
  const data = upsertSchema.partial().parse(req.body);
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json(user);
});

usersRouter.delete("/:id", async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.status(204).end();
});

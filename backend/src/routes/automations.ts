import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";

export const automationsRouter = Router();

const TRIGGERS = [
  "task_created",
  "task_status_changed",
  "comment_created",
  "form_submitted",
] as const;

const ACTION_TYPES = [
  "send_notification",
  "assign_user",
  "change_status",
  "change_priority",
  "add_comment",
] as const;

const actionSchema = z.object({
  type: z.enum(ACTION_TYPES),
  userId: z.string().uuid().optional(),
  message: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  body: z.string().optional(),
});

const upsertSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(TRIGGERS),
  conditions: z.record(z.unknown()).optional().nullable(),
  actions: z.array(actionSchema).min(1),
  isActive: z.boolean().optional(),
  createdById: z.string().uuid().optional().nullable(),
});

automationsRouter.get("/", async (_req, res) => {
  const rules = await prisma.automationRule.findMany({
    orderBy: { updatedAt: "desc" },
  });
  res.json(rules);
});

automationsRouter.get("/:id", async (req, res) => {
  const rule = await prisma.automationRule.findUnique({
    where: { id: req.params.id },
  });
  if (!rule) throw new HttpError(404, "rule_not_found");
  res.json(rule);
});

automationsRouter.post("/", async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const rule = await prisma.automationRule.create({
    data: {
      name: data.name,
      triggerType: data.triggerType,
      conditions: (data.conditions ?? null) as never,
      actions: data.actions as never,
      isActive: data.isActive ?? true,
      createdById: data.createdById ?? null,
    },
  });
  res.status(201).json(rule);
});

automationsRouter.patch("/:id", async (req, res) => {
  const data = upsertSchema.partial().parse(req.body);
  const rule = await prisma.automationRule.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      triggerType: data.triggerType,
      conditions: data.conditions === undefined ? undefined : (data.conditions as never),
      actions: data.actions === undefined ? undefined : (data.actions as never),
      isActive: data.isActive,
    },
  });
  res.json(rule);
});

automationsRouter.delete("/:id", async (req, res) => {
  await prisma.automationRule.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { WEBHOOK_EVENTS, generateWebhookSecret } from "../lib/webhooks";

export const webhooksRouter = Router();

const upsertSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  isActive: z.boolean().optional(),
  createdById: z.string().uuid().optional().nullable(),
});

webhooksRouter.get("/", async (_req, res) => {
  const subs = await prisma.webhookSubscription.findMany({
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(subs);
});

webhooksRouter.post("/", async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const secret = generateWebhookSecret();
  const sub = await prisma.webhookSubscription.create({
    data: {
      url: data.url,
      events: data.events,
      isActive: data.isActive ?? true,
      createdById: data.createdById ?? null,
      secret,
    },
  });
  // Return secret once, never again.
  res.status(201).json({
    id: sub.id,
    url: sub.url,
    events: sub.events,
    isActive: sub.isActive,
    createdAt: sub.createdAt,
    secret,
  });
});

webhooksRouter.patch("/:id", async (req, res) => {
  const data = upsertSchema.partial().parse(req.body);
  const sub = await prisma.webhookSubscription.update({
    where: { id: req.params.id },
    data: {
      url: data.url,
      events: data.events,
      isActive: data.isActive,
    },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
    },
  });
  res.json(sub);
});

webhooksRouter.delete("/:id", async (req, res) => {
  await prisma.webhookSubscription.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

webhooksRouter.get("/:id/deliveries", async (req, res) => {
  const sub = await prisma.webhookSubscription.findUnique({
    where: { id: req.params.id },
  });
  if (!sub) throw new HttpError(404, "subscription_not_found");
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { subscriptionId: sub.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(deliveries);
});

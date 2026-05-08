import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";

export const notificationsRouter = Router();

notificationsRouter.get("/", async (req, res) => {
  const userId = (req.query.userId as string) ?? "";
  if (!userId) throw new HttpError(400, "userId_required");
  const unreadOnly = req.query.unreadOnly === "true";
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  res.json({ items, unread });
});

notificationsRouter.patch("/read-all", async (req, res) => {
  const userId = z.object({ userId: z.string().uuid() }).parse(req.body).userId;
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  res.json({ ok: true });
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  const n = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json(n);
});

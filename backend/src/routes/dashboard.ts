import { Router } from "express";
import { prisma } from "../prisma";

export const dashboardRouter = Router();

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeek = () => {
  const d = startOfDay();
  d.setDate(d.getDate() + 7);
  return d;
};

dashboardRouter.get("/me", async (req, res) => {
  const userId = (req.query.userId as string) ?? "";
  if (!userId) {
    res.json({ open: [], overdue: [], dueThisWeek: [], recent: [] });
    return;
  }
  const now = new Date();
  const [open, overdue, dueThisWeek, recent] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { notIn: ["done", "cancelled"] },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 50,
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { notIn: ["done", "cancelled"] },
        dueDate: { lt: startOfDay() },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { notIn: ["done", "cancelled"] },
        dueDate: { gte: startOfDay(), lte: endOfWeek() },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: { assignedToId: userId },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);
  res.json({ open, overdue, dueThisWeek, recent, asOf: now.toISOString() });
});

dashboardRouter.get("/manager", async (_req, res) => {
  const [byUser, projectsByStatus, completedThisWeek, blocked] = await Promise.all([
    prisma.task.groupBy({
      by: ["assignedToId", "status"],
      _count: { _all: true },
      where: { status: { notIn: ["done", "cancelled"] } },
    }),
    prisma.project.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.task.count({
      where: {
        status: "done",
        completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.task.findMany({
      where: { status: "waiting" },
      include: {
        assignedTo: { select: { id: true, displayName: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
  ]);
  res.json({ byUser, projectsByStatus, completedThisWeek, blocked });
});

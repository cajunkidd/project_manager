import { Router } from "express";
import { prisma } from "../prisma";

export const reportsRouter = Router();

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const weekStart = (d: Date) => {
  // Monday start
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = Mon
  x.setDate(x.getDate() - day);
  return x;
};

reportsRouter.get("/tasks-by-user", async (_req, res) => {
  const rows = await prisma.task.groupBy({
    by: ["assignedToId", "status"],
    _count: { _all: true },
    where: { status: { notIn: ["done", "cancelled"] } },
  });
  const userIds = [...new Set(rows.map((r) => r.assignedToId).filter(Boolean) as string[])];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  res.json({ rows, users });
});

reportsRouter.get("/overdue", async (_req, res) => {
  const tasks = await prisma.task.findMany({
    where: {
      status: { notIn: ["done", "cancelled"] },
      dueDate: { lt: startOfDay() },
    },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, displayName: true } },
    },
    orderBy: { dueDate: "asc" },
  });
  res.json(tasks);
});

reportsRouter.get("/projects-by-status", async (_req, res) => {
  const rows = await prisma.project.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  res.json(rows);
});

reportsRouter.get("/completed-by-week", async (_req, res) => {
  const weeks = Number((_req.query.weeks as string) ?? 8);
  const since = weekStart(new Date(Date.now() - (weeks - 1) * 7 * 24 * 60 * 60 * 1000));
  const tasks = await prisma.task.findMany({
    where: { status: "done", completedAt: { gte: since } },
    select: { completedAt: true },
  });
  const buckets = new Map<string, number>();
  for (let i = 0; i < weeks; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i * 7);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const k = weekStart(t.completedAt).toISOString().slice(0, 10);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  res.json([...buckets.entries()].map(([weekStart, count]) => ({ weekStart, count })));
});

reportsRouter.get("/avg-completion-time", async (_req, res) => {
  const days = Number((_req.query.days as string) ?? 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: { status: "done", completedAt: { gte: since } },
    select: { createdAt: true, completedAt: true },
  });
  if (tasks.length === 0) {
    res.json({ count: 0, avgMs: 0, avgDays: 0 });
    return;
  }
  const total = tasks.reduce(
    (acc, t) => acc + (t.completedAt!.getTime() - t.createdAt.getTime()),
    0,
  );
  const avgMs = Math.round(total / tasks.length);
  res.json({
    count: tasks.length,
    avgMs,
    avgDays: +(avgMs / (24 * 60 * 60 * 1000)).toFixed(2),
  });
});

reportsRouter.get("/blocked", async (_req, res) => {
  const tasks = await prisma.task.findMany({
    where: { status: "waiting" },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, displayName: true } },
    },
    orderBy: { updatedAt: "asc" },
  });
  res.json(tasks);
});

reportsRouter.get("/workload", async (_req, res) => {
  const today = startOfDay();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (u) => {
      const [open, overdue, urgent, dueThisWeek, completedThisWeek] = await Promise.all([
        prisma.task.count({
          where: { assignedToId: u.id, status: { notIn: ["done", "cancelled"] } },
        }),
        prisma.task.count({
          where: {
            assignedToId: u.id,
            status: { notIn: ["done", "cancelled"] },
            dueDate: { lt: today },
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: u.id,
            status: { notIn: ["done", "cancelled"] },
            priority: "urgent",
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: u.id,
            status: { notIn: ["done", "cancelled"] },
            dueDate: { gte: today, lte: weekFromNow },
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: u.id,
            status: "done",
            completedAt: { gte: weekAgo },
          },
        }),
      ]);
      return {
        userId: u.id,
        displayName: u.displayName,
        department: u.department,
        open,
        overdue,
        urgent,
        dueThisWeek,
        completedThisWeek,
      };
    }),
  );
  res.json(rows);
});

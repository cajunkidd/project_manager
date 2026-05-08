import { prisma } from "../prisma";
import { logActivity } from "./activity";
import { notify } from "./notify";
import { runAutomations } from "./automation";

const SCAN_INTERVAL_MS = Number(process.env.OVERDUE_SCAN_MS ?? 5 * 60 * 1000);

async function scanOnce() {
  const now = new Date();
  const candidates = await prisma.task.findMany({
    where: {
      status: { notIn: ["done", "cancelled"] },
      completedAt: null,
      dueDate: { lt: now },
    },
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      priority: true,
      assignedToId: true,
    },
  });
  if (candidates.length === 0) return;

  // Dedupe: skip tasks we've already marked due_passed.
  const fired = await prisma.activityLog.findMany({
    where: {
      entityType: "task",
      action: "due_passed",
      entityId: { in: candidates.map((t) => t.id) },
    },
    select: { entityId: true },
  });
  const firedSet = new Set(fired.map((f) => f.entityId));
  const fresh = candidates.filter((t) => !firedSet.has(t.id));
  if (fresh.length === 0) return;

  for (const task of fresh) {
    await logActivity({
      entityType: "task",
      entityId: task.id,
      action: "due_passed",
    });
    if (task.assignedToId) {
      await notify({
        userId: task.assignedToId,
        title: "Overdue: " + task.title,
        message: "Task due date has passed.",
        type: "status_changed",
        entityType: "task",
        entityId: task.id,
      });
    }
    await runAutomations({ trigger: "task_due_date_passed", task });
  }
  // eslint-disable-next-line no-console
  console.log(`[overdue-scanner] fired due_passed for ${fresh.length} task(s)`);
}

export function startOverdueScanner() {
  // Initial scan after a short delay so the server can finish booting.
  setTimeout(() => {
    scanOnce().catch((e) =>
      // eslint-disable-next-line no-console
      console.error("[overdue-scanner] initial scan failed", e),
    );
  }, 10_000);
  setInterval(() => {
    scanOnce().catch((e) =>
      // eslint-disable-next-line no-console
      console.error("[overdue-scanner] scan failed", e),
    );
  }, SCAN_INTERVAL_MS);
  // eslint-disable-next-line no-console
  console.log(
    `[overdue-scanner] running every ${Math.round(SCAN_INTERVAL_MS / 1000)}s`,
  );
}

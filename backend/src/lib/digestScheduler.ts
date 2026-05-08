import { prisma } from "../prisma";
import { appLink, emailEnabled, sendEmail } from "./email";

const DAY_MS = 24 * 60 * 60 * 1000;

function nextDigestDelayMs(targetHour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function buildDigestForUser(userId: string) {
  const today = startOfDay();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);

  const [open, overdue, dueThisWeek] = await Promise.all([
    prisma.task.count({
      where: { assignedToId: userId, status: { notIn: ["done", "cancelled"] } },
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { notIn: ["done", "cancelled"] },
        dueDate: { lt: today },
      },
      include: { project: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { notIn: ["done", "cancelled"] },
        dueDate: { gte: today, lte: weekFromNow },
      },
      include: { project: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  if (open === 0 && overdue.length === 0 && dueThisWeek.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push(`You have ${open} open task${open === 1 ? "" : "s"}.`);
  lines.push("");
  if (overdue.length > 0) {
    lines.push(`Overdue (${overdue.length}):`);
    for (const t of overdue) {
      lines.push(
        `  • ${t.title}${t.project ? ` [${t.project.name}]` : ""} — due ${
          t.dueDate?.toLocaleDateString() ?? ""
        }`,
      );
    }
    lines.push("");
  }
  if (dueThisWeek.length > 0) {
    lines.push(`Due this week (${dueThisWeek.length}):`);
    for (const t of dueThisWeek) {
      lines.push(
        `  • ${t.title}${t.project ? ` [${t.project.name}]` : ""} — due ${
          t.dueDate?.toLocaleDateString() ?? ""
        }`,
      );
    }
    lines.push("");
  }
  lines.push(`Open dashboard: ${appLink("/dashboard")}`);
  return lines.join("\n");
}

async function sendDigestRound() {
  if (!emailEnabled()) return;
  const users = await prisma.user.findMany({
    where: { isActive: true, emailNotificationsEnabled: true },
    select: { id: true, email: true, displayName: true },
  });
  let sent = 0;
  for (const u of users) {
    const body = await buildDigestForUser(u.id);
    if (!body) continue;
    const ok = await sendEmail({
      to: u.email,
      subject: `Your daily task digest — ${new Date().toLocaleDateString()}`,
      text: `Hi ${u.displayName},\n\n${body}\n`,
    });
    if (ok) sent += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`[digest] sent ${sent}/${users.length} digests`);
}

export function startDigestScheduler() {
  if (!emailEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[digest] SMTP not configured; daily digest disabled");
    return;
  }
  const targetHour = Number(process.env.DAILY_DIGEST_HOUR ?? 8);
  const schedule = () => {
    const delay = nextDigestDelayMs(targetHour);
    setTimeout(async () => {
      try {
        await sendDigestRound();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[digest] round failed", e);
      } finally {
        // After the first round, schedule daily.
        setInterval(() => {
          sendDigestRound().catch((e) =>
            // eslint-disable-next-line no-console
            console.error("[digest] round failed", e),
          );
        }, DAY_MS);
      }
    }, delay);
  };
  schedule();
  // eslint-disable-next-line no-console
  console.log(
    `[digest] daily digest scheduled for ${targetHour}:00 server local time`,
  );
}

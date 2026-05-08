// Pure, deterministic risk scoring.
// Kept dependency-free so it can be exercised in unit tests without Prisma.

export interface RiskTaskInput {
  status: string;
  dueDate: Date | null;
  assignedToId: string | null;
}

export interface RiskInput {
  tasks: RiskTaskInput[];
  projectDueDate: Date | null;
  lastActivityAt: Date | null;
  now?: Date;
}

export interface RiskResult {
  score: number;
  level: "low" | "medium" | "high";
  explanation: string;
  signals: {
    overdue: number;
    blocked: number;
    unassigned: number;
    daysSinceActivity: number;
    dueProximityDays: number | null;
    openTasks: number;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function computeRisk(input: RiskInput): RiskResult {
  const now = input.now ?? new Date();
  const today = startOfDay(now);

  const open = input.tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  );
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;
  const blocked = open.filter((t) => t.status === "waiting").length;
  const unassigned = open.filter((t) => !t.assignedToId).length;

  const daysSinceActivity = input.lastActivityAt
    ? Math.floor((now.getTime() - input.lastActivityAt.getTime()) / DAY_MS)
    : 999;

  const dueProximityDays = input.projectDueDate
    ? Math.floor((input.projectDueDate.getTime() - today.getTime()) / DAY_MS)
    : null;

  const reasons: string[] = [];
  let score = 0;
  if (overdue > 0) {
    score += Math.min(40, overdue * 8);
    reasons.push(`${overdue} overdue task${overdue === 1 ? "" : "s"}`);
  }
  if (blocked > 0) {
    score += Math.min(20, blocked * 5);
    reasons.push(`${blocked} blocked task${blocked === 1 ? "" : "s"}`);
  }
  if (unassigned > 0 && open.length > 0) {
    const ratio = unassigned / open.length;
    const v = Math.round(ratio * 15);
    if (v > 0) {
      score += v;
      reasons.push(`${unassigned} unassigned`);
    }
  }
  if (daysSinceActivity >= 7) {
    score += Math.min(15, daysSinceActivity);
    reasons.push(`no activity in ${daysSinceActivity}d`);
  }
  if (
    dueProximityDays !== null &&
    dueProximityDays >= 0 &&
    dueProximityDays <= 7 &&
    open.length > 0
  ) {
    score += 10;
    reasons.push(`due in ${dueProximityDays}d with ${open.length} open`);
  } else if (dueProximityDays !== null && dueProximityDays < 0) {
    score += 20;
    reasons.push(`past due by ${-dueProximityDays}d`);
  }

  score = Math.min(100, score);
  const level: RiskResult["level"] =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const explanation =
    reasons.length === 0
      ? "Project looks healthy. No risk signals."
      : `Risk drivers: ${reasons.join(", ")}.`;

  return {
    score,
    level,
    explanation,
    signals: {
      overdue,
      blocked,
      unassigned,
      daysSinceActivity,
      dueProximityDays,
      openTasks: open.length,
    },
  };
}

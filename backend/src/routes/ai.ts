import { Router } from "express";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { AI_MODEL, getAnthropic } from "../lib/anthropic";

export const aiRouter = Router();

aiRouter.get("/status", (_req, res) => {
  res.json({ enabled: !!process.env.ANTHROPIC_API_KEY, model: AI_MODEL });
});

// ---------- Risk score (deterministic — no AI needed) ----------

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

aiRouter.get("/risk/:projectId", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    include: { tasks: true },
  });
  if (!project) throw new HttpError(404, "project_not_found");

  const today = startOfDay();
  const open = project.tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  );
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;
  const blocked = open.filter((t) => t.status === "waiting").length;
  const unassigned = open.filter((t) => !t.assignedToId).length;

  const lastActivity = await prisma.activityLog.findFirst({
    where: {
      OR: [
        { entityType: "project", entityId: project.id },
        {
          entityType: "task",
          entityId: { in: project.tasks.map((t) => t.id) },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  const daysSinceActivity = lastActivity
    ? Math.floor(
        (Date.now() - lastActivity.createdAt.getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : 999;

  const dueProximityDays = project.dueDate
    ? Math.floor(
        (project.dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
      )
    : null;

  // Weighted score, capped at 100.
  const reasons: string[] = [];
  let score = 0;
  if (overdue > 0) {
    const v = Math.min(40, overdue * 8);
    score += v;
    reasons.push(`${overdue} overdue task${overdue === 1 ? "" : "s"}`);
  }
  if (blocked > 0) {
    const v = Math.min(20, blocked * 5);
    score += v;
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
    const v = Math.min(15, daysSinceActivity);
    score += v;
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
  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const explanation =
    reasons.length === 0
      ? "Project looks healthy. No risk signals."
      : `Risk drivers: ${reasons.join(", ")}.`;

  res.json({
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
  });
});

// ---------- AI project summary ----------

aiRouter.post("/summary/:projectId", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    include: {
      owner: { select: { displayName: true } },
      tasks: {
        include: {
          assignedTo: { select: { displayName: true } },
        },
      },
    },
  });
  if (!project) throw new HttpError(404, "project_not_found");

  const today = startOfDay();
  const grouped = {
    done: project.tasks.filter((t) => t.status === "done"),
    open: project.tasks.filter(
      (t) => t.status !== "done" && t.status !== "cancelled",
    ),
    overdue: project.tasks.filter(
      (t) =>
        t.dueDate &&
        t.dueDate < today &&
        t.status !== "done" &&
        t.status !== "cancelled",
    ),
    blocked: project.tasks.filter((t) => t.status === "waiting"),
  };

  const recentActivity = await prisma.activityLog.findMany({
    where: {
      OR: [
        { entityType: "project", entityId: project.id },
        {
          entityType: "task",
          entityId: { in: project.tasks.map((t) => t.id) },
        },
      ],
    },
    include: { user: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const context = {
    project: {
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      owner: project.owner?.displayName ?? null,
      startDate: project.startDate,
      dueDate: project.dueDate,
    },
    counts: {
      total: project.tasks.length,
      done: grouped.done.length,
      open: grouped.open.length,
      overdue: grouped.overdue.length,
      blocked: grouped.blocked.length,
    },
    completed: grouped.done.slice(-10).map((t) => ({
      title: t.title,
      assignee: t.assignedTo?.displayName ?? null,
    })),
    open: grouped.open.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee: t.assignedTo?.displayName ?? null,
      dueDate: t.dueDate,
    })),
    overdue: grouped.overdue.map((t) => ({
      title: t.title,
      assignee: t.assignedTo?.displayName ?? null,
      dueDate: t.dueDate,
    })),
    recentActivity: recentActivity.map((a) => ({
      action: a.action,
      user: a.user?.displayName ?? "system",
      at: a.createdAt,
    })),
  };

  const client = getAnthropic();
  const msg = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: [
          "You write concise, accurate project status summaries for an internal project management tool.",
          "Ground every claim in the supplied JSON context. Do not invent tasks, dates, owners, or events.",
          "If a section has no data, say so plainly. Be direct, no marketing tone.",
          "Output sections in this order: Status, Completed work, Open work, Overdue & blockers, Risks, Recommended next steps.",
          "Keep each section to 1–4 short bullet points.",
        ].join(" "),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Project context (JSON):\n${JSON.stringify(context, null, 2)}\n\nWrite the status summary now.`,
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  res.json({
    summary: text,
    usage: msg.usage,
    model: msg.model,
    generatedAt: new Date().toISOString(),
  });
});

// ---------- AI task extraction ----------

const extractRequestSchema = z.object({
  projectId: z.string().uuid(),
  text: z.string().min(10),
});

aiRouter.post("/extract-tasks", async (req, res) => {
  const { projectId, text } = extractRequestSchema.parse(req.body);

  const [project, users] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, role: true, department: true },
    }),
  ]);
  if (!project) throw new HttpError(404, "project_not_found");

  const userRoster = users.map((u) => ({
    id: u.id,
    name: u.displayName,
    role: u.role,
    department: u.department,
  }));

  const client = getAnthropic();
  const msg = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    system: [
      "You extract structured tasks from free-form notes for a project management tool.",
      "Only emit tasks that are clearly described in the input. Do not invent work the user did not mention.",
      "When a person is named, set assignedToUserId to the matching user from the roster.",
      "Use ISO 8601 dates only when the input names an explicit date. Otherwise leave dueDate null.",
    ].join(" "),
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  description: { type: ["string", "null"] },
                  priority: {
                    type: "string",
                    enum: ["low", "normal", "high", "urgent"],
                  },
                  assignedToUserId: { type: ["string", "null"] },
                  assigneeRationale: { type: ["string", "null"] },
                  dueDate: { type: ["string", "null"] },
                },
                required: [
                  "title",
                  "description",
                  "priority",
                  "assignedToUserId",
                  "assigneeRationale",
                  "dueDate",
                ],
              },
            },
          },
          required: ["tasks"],
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          `Project: ${project.name}`,
          project.description ? `Project description: ${project.description}` : "",
          `Active users (id — name — role — department):`,
          ...userRoster.map(
            (u) => `- ${u.id} — ${u.name} — ${u.role} — ${u.department ?? "—"}`,
          ),
          "",
          "Notes to extract tasks from:",
          text,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const textBlock = msg.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) throw new HttpError(502, "ai_no_text_response");
  let parsed: { tasks: unknown };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new HttpError(502, "ai_invalid_json");
  }

  res.json({
    suggestions: parsed.tasks ?? [],
    usage: msg.usage,
    model: msg.model,
  });
});


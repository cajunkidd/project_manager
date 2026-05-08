import { describe, expect, it } from "vitest";
import { computeRisk } from "./risk";

const NOW = new Date("2026-05-08T10:00:00Z");
const today = new Date("2026-05-08T00:00:00Z");
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const inThreeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
const inTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

describe("computeRisk", () => {
  it("returns low risk for a healthy project", () => {
    const r = computeRisk({
      tasks: [
        { status: "to_do", dueDate: inTwoWeeks, assignedToId: "u1" },
        { status: "done", dueDate: yesterday, assignedToId: "u1" },
      ],
      projectDueDate: inTwoWeeks,
      lastActivityAt: NOW,
      now: NOW,
    });
    expect(r.level).toBe("low");
    expect(r.score).toBe(0);
    expect(r.signals.overdue).toBe(0);
    expect(r.signals.openTasks).toBe(1);
  });

  it("counts overdue open tasks but ignores done", () => {
    const r = computeRisk({
      tasks: [
        { status: "to_do", dueDate: yesterday, assignedToId: "u1" },
        { status: "in_progress", dueDate: yesterday, assignedToId: "u2" },
        { status: "done", dueDate: yesterday, assignedToId: "u1" },
      ],
      projectDueDate: null,
      lastActivityAt: NOW,
      now: NOW,
    });
    expect(r.signals.overdue).toBe(2);
    expect(r.score).toBeGreaterThanOrEqual(16); // overdue contribution capped at 40
  });

  it("flags blocked tasks", () => {
    const r = computeRisk({
      tasks: [
        { status: "waiting", dueDate: inTwoWeeks, assignedToId: "u1" },
        { status: "waiting", dueDate: inTwoWeeks, assignedToId: "u2" },
      ],
      projectDueDate: null,
      lastActivityAt: NOW,
      now: NOW,
    });
    expect(r.signals.blocked).toBe(2);
    expect(r.explanation).toContain("blocked");
  });

  it("escalates when project is past due", () => {
    const r = computeRisk({
      tasks: [
        { status: "in_progress", dueDate: inThreeDays, assignedToId: "u1" },
      ],
      projectDueDate: yesterday,
      lastActivityAt: NOW,
      now: NOW,
    });
    expect(r.signals.dueProximityDays).toBeLessThan(0);
    expect(r.score).toBeGreaterThanOrEqual(20);
    expect(r.explanation).toContain("past due");
  });

  it("caps the score at 100", () => {
    // Stack every signal at its max: 40 overdue + 20 blocked + 15 unassigned
    // + 15 stale + 20 past-due = 110 raw, capped to 100.
    const tasks: Parameters<typeof computeRisk>[0]["tasks"] = [];
    for (let i = 0; i < 10; i++) {
      tasks.push({ status: "to_do", dueDate: yesterday, assignedToId: null });
    }
    for (let i = 0; i < 5; i++) {
      tasks.push({ status: "waiting", dueDate: null, assignedToId: null });
    }
    const r = computeRisk({
      tasks,
      projectDueDate: yesterday,
      lastActivityAt: new Date("2026-01-01"),
      now: NOW,
    });
    expect(r.score).toBe(100);
    expect(r.level).toBe("high");
  });

  it("treats absent activity as very stale", () => {
    const r = computeRisk({
      tasks: [{ status: "to_do", dueDate: null, assignedToId: "u1" }],
      projectDueDate: null,
      lastActivityAt: null,
      now: NOW,
    });
    expect(r.signals.daysSinceActivity).toBe(999);
    expect(r.explanation).toContain("no activity");
  });
});

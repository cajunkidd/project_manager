import { describe, expect, it } from "vitest";
import { matches, type EventCtx } from "./automation";

const taskCtx: EventCtx = {
  trigger: "task_created",
  task: {
    id: "task-1",
    projectId: "proj-1",
    status: "to_do",
    priority: "high",
    assignedToId: "user-1",
    title: "Replace switch",
  },
};

const commentCtx: EventCtx = {
  trigger: "comment_created",
  comment: {
    id: "c-1",
    taskId: "task-1",
    projectId: null,
    userId: "user-2",
    body: "shipped",
  },
};

const formCtx: EventCtx = {
  trigger: "form_submitted",
  formId: "form-1",
  task: {
    id: "task-1",
    projectId: "proj-1",
    assignedToId: "user-1",
    title: "IT request",
  },
};

describe("automation.matches", () => {
  it("matches when conditions is null or empty", () => {
    expect(matches(null, taskCtx)).toBe(true);
    expect(matches({}, taskCtx)).toBe(true);
  });

  it("ignores blank condition values", () => {
    expect(matches({ status: "" }, taskCtx)).toBe(true);
    expect(matches({ status: null }, taskCtx)).toBe(true);
  });

  it("matches task triggers on equality", () => {
    expect(matches({ projectId: "proj-1" }, taskCtx)).toBe(true);
    expect(matches({ priority: "high" }, taskCtx)).toBe(true);
    expect(matches({ status: "to_do", priority: "high" }, taskCtx)).toBe(true);
  });

  it("rejects when any condition mismatches", () => {
    expect(matches({ priority: "low" }, taskCtx)).toBe(false);
    expect(matches({ status: "to_do", priority: "low" }, taskCtx)).toBe(false);
    expect(matches({ projectId: "other" }, taskCtx)).toBe(false);
  });

  it("matches comment triggers against the comment entity", () => {
    expect(matches({ taskId: "task-1" }, commentCtx)).toBe(true);
    expect(matches({ taskId: "task-2" }, commentCtx)).toBe(false);
  });

  it("matches form_submitted against formId and projectId", () => {
    expect(matches({ formId: "form-1" }, formCtx)).toBe(true);
    expect(matches({ projectId: "proj-1" }, formCtx)).toBe(true);
    expect(matches({ formId: "form-2" }, formCtx)).toBe(false);
  });
});

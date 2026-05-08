import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { logActivity } from "../lib/activity";
import { notify } from "../lib/notify";
import { runAutomations } from "../lib/automation";

export const formsRouter = Router();

const FIELD_TYPES = [
  "text",
  "textarea",
  "dropdown",
  "checkbox",
  "date",
  "user_picker",
] as const;

const fieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  fieldType: z.enum(FIELD_TYPES),
  isRequired: z.boolean().optional(),
  options: z.array(z.string()).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const upsertFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  defaultProjectId: z.string().uuid().optional().nullable(),
  defaultAssigneeId: z.string().uuid().optional().nullable(),
  defaultPriority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  isActive: z.boolean().optional(),
  fields: z.array(fieldSchema).optional(),
});

formsRouter.get("/", async (req, res) => {
  const onlyActive = req.query.active === "true";
  const forms = await prisma.form.findMany({
    where: onlyActive ? { isActive: true } : {},
    include: {
      defaultProject: { select: { id: true, name: true } },
      defaultAssignee: { select: { id: true, displayName: true } },
      _count: { select: { submissions: true, fields: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(forms);
});

formsRouter.get("/:id", async (req, res) => {
  const form = await prisma.form.findUnique({
    where: { id: req.params.id },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      defaultProject: { select: { id: true, name: true } },
      defaultAssignee: { select: { id: true, displayName: true } },
    },
  });
  if (!form) throw new HttpError(404, "form_not_found");
  res.json(form);
});

formsRouter.post("/", async (req, res) => {
  const data = upsertFormSchema.parse(req.body);
  const createdById = z
    .object({ createdById: z.string().uuid().optional().nullable() })
    .parse(req.body).createdById;
  const form = await prisma.form.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      defaultProjectId: data.defaultProjectId ?? null,
      defaultAssigneeId: data.defaultAssigneeId ?? null,
      defaultPriority: data.defaultPriority,
      isActive: data.isActive ?? true,
      createdById: createdById ?? null,
      fields: data.fields
        ? {
            create: data.fields.map((f, i) => ({
              label: f.label,
              fieldType: f.fieldType,
              isRequired: f.isRequired ?? false,
              options: (f.options ?? null) as never,
              sortOrder: f.sortOrder ?? i,
            })),
          }
        : undefined,
    },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  res.status(201).json(form);
});

formsRouter.patch("/:id", async (req, res) => {
  const data = upsertFormSchema.partial().parse(req.body);
  const form = await prisma.form.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      description: data.description,
      defaultProjectId: data.defaultProjectId,
      defaultAssigneeId: data.defaultAssigneeId,
      defaultPriority: data.defaultPriority,
      isActive: data.isActive,
    },
  });
  if (data.fields) {
    // Replace fields wholesale; simpler than diffing.
    await prisma.formField.deleteMany({ where: { formId: form.id } });
    await prisma.formField.createMany({
      data: data.fields.map((f, i) => ({
        formId: form.id,
        label: f.label,
        fieldType: f.fieldType,
        isRequired: f.isRequired ?? false,
        options: (f.options ?? null) as never,
        sortOrder: f.sortOrder ?? i,
      })),
    });
  }
  const fresh = await prisma.form.findUnique({
    where: { id: form.id },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  res.json(fresh);
});

formsRouter.delete("/:id", async (req, res) => {
  await prisma.form.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

const submitSchema = z.object({
  submittedById: z.string().uuid().optional().nullable(),
  responses: z.record(z.unknown()),
});

formsRouter.post("/:id/submit", async (req, res) => {
  const { submittedById, responses } = submitSchema.parse(req.body);
  const form = await prisma.form.findUnique({
    where: { id: req.params.id },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!form) throw new HttpError(404, "form_not_found");
  if (!form.isActive) throw new HttpError(400, "form_inactive");
  if (!form.defaultProjectId) {
    throw new HttpError(400, "form_missing_default_project");
  }

  // Required-field check
  for (const f of form.fields) {
    if (f.isRequired) {
      const v = responses[f.id];
      if (
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0)
      ) {
        throw new HttpError(400, `missing_required_field:${f.label}`);
      }
    }
  }

  // Build a task title and description from responses
  const firstText = form.fields.find(
    (f) =>
      (f.fieldType === "text" || f.fieldType === "textarea") &&
      typeof responses[f.id] === "string" &&
      (responses[f.id] as string).trim() !== "",
  );
  const title =
    firstText && typeof responses[firstText.id] === "string"
      ? `${form.name}: ${(responses[firstText.id] as string).slice(0, 80)}`
      : form.name;

  const description = form.fields
    .map((f) => {
      const raw = responses[f.id];
      const display =
        raw === undefined || raw === null
          ? "—"
          : Array.isArray(raw)
          ? raw.join(", ")
          : typeof raw === "boolean"
          ? raw
            ? "Yes"
            : "No"
          : String(raw);
      return `**${f.label}**: ${display}`;
    })
    .join("\n");

  // Resolve user_picker assignee override (first one wins)
  const pickerField = form.fields.find((f) => f.fieldType === "user_picker");
  const pickerValue = pickerField ? responses[pickerField.id] : undefined;
  const assigneeId =
    typeof pickerValue === "string" && pickerValue
      ? pickerValue
      : form.defaultAssigneeId ?? null;

  const task = await prisma.task.create({
    data: {
      projectId: form.defaultProjectId,
      title,
      description,
      priority: form.defaultPriority,
      assignedToId: assigneeId,
      createdById: submittedById ?? null,
    },
  });

  const submission = await prisma.formSubmission.create({
    data: {
      formId: form.id,
      submittedById: submittedById ?? null,
      responseData: responses as never,
      createdTaskId: task.id,
    },
  });

  await logActivity({
    entityType: "task",
    entityId: task.id,
    action: "created_from_form",
    userId: submittedById ?? null,
    newValue: { formId: form.id, formName: form.name },
  });

  if (assigneeId && assigneeId !== submittedById) {
    await notify({
      userId: assigneeId,
      title: "Assigned: " + task.title,
      message: `New task from form "${form.name}".`,
      type: "task_assigned",
      entityType: "task",
      entityId: task.id,
    });
  }

  await runAutomations({
    trigger: "form_submitted",
    formId: form.id,
    task: {
      id: task.id,
      projectId: task.projectId,
      assignedToId: task.assignedToId,
      title: task.title,
    },
  });

  res.status(201).json({ submission, task });
});

formsRouter.get("/:id/submissions", async (req, res) => {
  const submissions = await prisma.formSubmission.findMany({
    where: { formId: req.params.id },
    include: {
      submittedBy: { select: { id: true, displayName: true } },
      createdTask: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(submissions);
});

import { prisma } from '../../db/prisma';
import { eventBus } from '../../events/bus';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { tasksService } from '../tasks/tasks.service';

export const FIELD_TYPES = ['text', 'textarea', 'dropdown', 'checkbox', 'date', 'user'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FormFieldInput {
  id?: string;
  label: string;
  fieldType: FieldType;
  isRequired?: boolean;
  options?: string[] | null;
  sortOrder?: number;
}

export interface CreateFormInput {
  name: string;
  description?: string | null;
  defaultProjectId?: string | null;
  defaultAssigneeId?: string | null;
  defaultPriority?: string;
  isActive?: boolean;
  fields: FormFieldInput[];
}

export type UpdateFormInput = Partial<CreateFormInput>;

const FORM_INCLUDE = {
  fields: { orderBy: { sortOrder: 'asc' } as const },
  defaultProject: { select: { id: true, name: true } },
  defaultAssignee: { select: { id: true, displayName: true, email: true } },
} as const;

function serializeOptions(options?: string[] | null): string | null {
  if (!options || !options.length) return null;
  return JSON.stringify(options);
}

export const formsService = {
  async list(opts: { onlyActive?: boolean } = {}) {
    return prisma.form.findMany({
      where: opts.onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
      include: FORM_INCLUDE,
    });
  },

  async getById(id: string) {
    const form = await prisma.form.findUnique({ where: { id }, include: FORM_INCLUDE });
    if (!form) throw new NotFoundError('Form not found');
    return form;
  },

  async create(input: CreateFormInput, userId?: string) {
    return prisma.form.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        defaultProjectId: input.defaultProjectId ?? null,
        defaultAssigneeId: input.defaultAssigneeId ?? null,
        defaultPriority: input.defaultPriority ?? 'normal',
        isActive: input.isActive ?? true,
        createdById: userId ?? null,
        fields: {
          create: input.fields.map((f, idx) => ({
            label: f.label,
            fieldType: f.fieldType,
            isRequired: f.isRequired ?? false,
            options: serializeOptions(f.options),
            sortOrder: f.sortOrder ?? idx,
          })),
        },
      },
      include: FORM_INCLUDE,
    });
  },

  async update(id: string, input: UpdateFormInput) {
    await this.getById(id);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.defaultProjectId !== undefined) data.defaultProjectId = input.defaultProjectId;
    if (input.defaultAssigneeId !== undefined) data.defaultAssigneeId = input.defaultAssigneeId;
    if (input.defaultPriority !== undefined) data.defaultPriority = input.defaultPriority;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (input.fields) {
      await prisma.formField.deleteMany({ where: { formId: id } });
      data.fields = {
        create: input.fields.map((f, idx) => ({
          label: f.label,
          fieldType: f.fieldType,
          isRequired: f.isRequired ?? false,
          options: serializeOptions(f.options),
          sortOrder: f.sortOrder ?? idx,
        })),
      };
    }

    return prisma.form.update({ where: { id }, data, include: FORM_INCLUDE });
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.form.delete({ where: { id } });
  },

  async submit(formId: string, responseData: Record<string, unknown>, userId?: string) {
    const form = await this.getById(formId);
    if (!form.isActive) throw new ValidationError('Form is not accepting submissions');

    for (const field of form.fields) {
      const value = responseData[field.id];
      if (field.isRequired && (value === undefined || value === null || value === '')) {
        throw new ValidationError(`Field "${field.label}" is required`);
      }
    }

    const titleField = form.fields.find((f) => f.fieldType === 'text') ?? form.fields[0];
    const titleFromResponse = titleField ? String(responseData[titleField.id] ?? '').trim() : '';
    const taskTitle = titleFromResponse || form.name;

    const descriptionLines = form.fields
      .map((f) => {
        const v = responseData[f.id];
        if (v === undefined || v === null || v === '') return null;
        return `${f.label}: ${typeof v === 'string' ? v : JSON.stringify(v)}`;
      })
      .filter((line): line is string => line !== null);
    const description = descriptionLines.join('\n');

    const task = await tasksService.create(
      {
        title: taskTitle,
        description: description || null,
        projectId: form.defaultProjectId ?? null,
        assignedToId: form.defaultAssigneeId ?? null,
        priority: form.defaultPriority,
        status: 'to_do',
      },
      userId,
    );

    const submission = await prisma.formSubmission.create({
      data: {
        formId,
        submittedById: userId ?? null,
        responseData: JSON.stringify(responseData),
        createdTaskId: task.id,
      },
    });

    await eventBus.emit({
      type: 'form.submitted',
      submission,
      formId,
      actorId: userId ?? null,
    });

    return { submission, task };
  },

  async listSubmissions(filters: { formId?: string; submittedById?: string } = {}) {
    return prisma.formSubmission.findMany({
      where: {
        ...(filters.formId ? { formId: filters.formId } : {}),
        ...(filters.submittedById ? { submittedById: filters.submittedById } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        form: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, displayName: true, email: true } },
        createdTask: { select: { id: true, title: true, status: true } },
      },
      take: 200,
    });
  },
};

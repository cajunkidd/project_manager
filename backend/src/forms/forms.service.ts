import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class FormsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activityLogs: ActivityLogsService,
    private webhooks: WebhooksService,
  ) {}

  async findAll(activeOnly = false) {
    return this.prisma.form.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: {
        defaultProject: { select: { id: true, name: true } },
        defaultAssignee: { select: { id: true, displayName: true } },
        createdBy: { select: { id: true, displayName: true } },
        _count: { select: { fields: true, submissions: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const form = await this.prisma.form.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { sortOrder: 'asc' } },
        defaultProject: { select: { id: true, name: true } },
        defaultAssignee: { select: { id: true, displayName: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async create(data: {
    name: string;
    description?: string;
    defaultProjectId?: string;
    defaultAssigneeId?: string;
    defaultPriority?: string;
    fields?: { label: string; fieldType: string; isRequired?: boolean; options?: any; sortOrder?: number }[];
  }, userId: string) {
    const { fields, ...formData } = data;
    const form = await this.prisma.form.create({
      data: {
        ...formData,
        createdById: userId,
        fields: fields
          ? { create: fields.map((f, i) => ({ ...f, sortOrder: f.sortOrder ?? i })) }
          : undefined,
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    return form;
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    defaultProjectId?: string;
    defaultAssigneeId?: string;
    defaultPriority?: string;
    isActive?: boolean;
    fields?: { label: string; fieldType: string; isRequired?: boolean; options?: any; sortOrder?: number }[];
  }) {
    await this.findById(id);
    const { fields, ...formData } = data;

    if (fields !== undefined) {
      await this.prisma.formField.deleteMany({ where: { formId: id } });
    }

    return this.prisma.form.update({
      where: { id },
      data: {
        ...formData,
        ...(fields !== undefined && {
          fields: { create: fields.map((f, i) => ({ ...f, sortOrder: f.sortOrder ?? i })) },
        }),
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async submit(formId: string, responseData: Record<string, any>, userId: string) {
    const form = await this.findById(formId);

    const task = await this.prisma.task.create({
      data: {
        title: responseData.title ?? `${form.name} — ${new Date().toLocaleDateString()}`,
        description: Object.entries(responseData)
          .map(([k, v]) => `**${k}**: ${v}`)
          .join('\n'),
        projectId: form.defaultProjectId ?? undefined,
        assignedTo: form.defaultAssigneeId ?? undefined,
        priority: form.defaultPriority ?? 'normal',
        status: 'to_do',
        createdById: userId,
      },
    });

    const submission = await this.prisma.formSubmission.create({
      data: {
        formId,
        submittedById: userId,
        responseData,
        createdTaskId: task.id,
      },
      include: {
        form: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, displayName: true } },
        createdTask: { select: { id: true, title: true } },
      },
    });

    if (form.defaultAssigneeId && form.defaultAssigneeId !== userId) {
      await this.notifications.create({
        userId: form.defaultAssigneeId,
        title: 'New Request Assigned',
        message: `A new ${form.name} request has been assigned to you: ${task.title}`,
        type: 'form_submitted',
        entityType: 'task',
        entityId: task.id,
      });
    }

    await this.activityLogs.log('task', task.id, 'created_from_form', null, { formId, formName: form.name }, userId);

    this.webhooks.dispatch('form.submitted', {
      submission, form: { id: form.id, name: form.name }, task: { id: task.id, title: task.title }, triggeredBy: userId,
    }).catch(() => {});

    return submission;
  }

  async getSubmissions(filters: { formId?: string; userId?: string }) {
    return this.prisma.formSubmission.findMany({
      where: {
        ...(filters.formId && { formId: filters.formId }),
        ...(filters.userId && { submittedById: filters.userId }),
      },
      include: {
        form: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, displayName: true } },
        createdTask: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

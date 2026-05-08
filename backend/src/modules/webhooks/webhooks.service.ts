import crypto from 'node:crypto';
import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../utils/errors';

export const WEBHOOK_EVENTS = [
  'task.created',
  'task.updated',
  'task.status_changed',
  'project.created',
  'project.updated',
  'comment.created',
  'form.submitted',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: WebhookEvent[];
  isActive?: boolean;
}

export const webhooksService = {
  async list() {
    return prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deliveries: true } } },
    });
  },

  async getById(id: string) {
    const sub = await prisma.webhookSubscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundError('Webhook not found');
    return sub;
  },

  async create(input: CreateWebhookInput, userId?: string) {
    const secret = crypto.randomBytes(32).toString('base64url');
    return prisma.webhookSubscription.create({
      data: {
        name: input.name,
        url: input.url,
        secret,
        events: input.events.join(','),
        isActive: input.isActive ?? true,
        createdById: userId ?? null,
      },
    });
  },

  async update(id: string, input: Partial<CreateWebhookInput>) {
    await this.getById(id);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.url !== undefined) data.url = input.url;
    if (input.events !== undefined) data.events = input.events.join(',');
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return prisma.webhookSubscription.update({ where: { id }, data });
  },

  async remove(id: string) {
    await this.getById(id);
    await prisma.webhookSubscription.delete({ where: { id } });
  },

  async listDeliveries(subscriptionId: string) {
    await this.getById(subscriptionId);
    return prisma.webhookDelivery.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },

  async findActiveForEvent(eventType: WebhookEvent) {
    const subs = await prisma.webhookSubscription.findMany({
      where: { isActive: true },
    });
    return subs.filter((sub) => sub.events.split(',').includes(eventType));
  },

  signPayload(secret: string, body: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  },
};

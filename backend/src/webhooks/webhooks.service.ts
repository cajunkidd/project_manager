import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 4096;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.webhookSubscription.findMany({
      include: {
        createdBy: { select: { id: true, displayName: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { name: string; url: string; events: string[] }, userId: string) {
    const secret = crypto.randomBytes(32).toString('hex');
    return this.prisma.webhookSubscription.create({
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        secret,
        createdById: userId,
      },
    });
  }

  async update(id: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }) {
    return this.prisma.webhookSubscription.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.webhookSubscription.delete({ where: { id } });
  }

  async listDeliveries(subscriptionId: string, limit = 50) {
    return this.prisma.webhookDelivery.findMany({
      where: { subscriptionId },
      orderBy: { deliveredAt: 'desc' },
      take: limit,
    });
  }

  async dispatch(event: string, payload: Record<string, any>) {
    const subs = await this.prisma.webhookSubscription.findMany({
      where: { isActive: true, events: { has: event } },
    });
    if (subs.length === 0) return;

    await Promise.all(subs.map((sub) => this.deliverOne(sub, event, payload)));
  }

  private async deliverOne(
    sub: { id: string; url: string; secret: string },
    event: string,
    payload: Record<string, any>,
  ) {
    const body = JSON.stringify({ event, deliveredAt: new Date().toISOString(), data: payload });
    const signature = crypto.createHmac('sha256', sub.secret).update(body).digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let status = 'failed';
    let statusCode: number | null = null;
    let response: string | null = null;
    let error: string | null = null;

    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Signature': `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
      });
      statusCode = res.status;
      const text = await res.text();
      response = text.slice(0, MAX_RESPONSE_BYTES);
      status = res.ok ? 'delivered' : 'failed';
    } catch (e: any) {
      error = e.message?.slice(0, 500) ?? 'unknown error';
      this.logger.warn(`Webhook delivery failed for ${sub.url}: ${error}`);
    } finally {
      clearTimeout(timeout);
    }

    await this.prisma.webhookDelivery.create({
      data: {
        subscriptionId: sub.id,
        event,
        payload,
        status,
        statusCode,
        response,
        error,
      },
    });
  }

  async redeliver(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { subscription: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return this.deliverOne(delivery.subscription, delivery.event, delivery.payload as Record<string, any>);
  }
}

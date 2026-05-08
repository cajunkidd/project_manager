import { prisma } from '../../db/prisma';
import { eventBus, type DomainEvent } from '../../events/bus';
import { webhooksService, WEBHOOK_EVENTS, type WebhookEvent } from './webhooks.service';

let registered = false;

const MAX_ATTEMPTS = Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? 3);
const BASE_BACKOFF_MS = Number(process.env.WEBHOOK_BASE_BACKOFF_MS ?? 250);

function buildPayload(event: DomainEvent): Record<string, unknown> {
  switch (event.type) {
    case 'task.created':
    case 'task.updated':
    case 'task.assigned':
    case 'task.status_changed':
      return { type: event.type, task: event.task };
    case 'project.created':
    case 'project.updated':
      return { type: event.type, project: event.project };
    case 'comment.created':
      return {
        type: event.type,
        taskId: event.taskId,
        projectId: event.projectId,
        body: event.body,
        authorId: event.authorId,
      };
    case 'form.submitted':
      return { type: event.type, submission: event.submission, formId: event.formId };
    default:
      return { type: (event as { type: string }).type };
  }
}

interface DeliveryResult {
  status: 'success' | 'failed';
  statusCode: number | null;
  responseBody: string | null;
}

async function attemptDelivery(
  subscription: { url: string; secret: string },
  eventType: WebhookEvent,
  body: string,
): Promise<DeliveryResult> {
  try {
    const signature = webhooksService.signPayload(subscription.secret, body);
    const res = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': eventType,
        'X-Webhook-Signature': `sha256=${signature}`,
      },
      body,
    });
    const text = await res.text().catch(() => '');
    return {
      status: res.ok ? 'success' : 'failed',
      statusCode: res.status,
      responseBody: text.slice(0, 1024),
    };
  } catch (err) {
    return {
      status: 'failed',
      statusCode: null,
      responseBody: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

function backoffDelay(attempt: number): number {
  // 250ms, 500ms, 1s, 2s, ...
  return BASE_BACKOFF_MS * 2 ** (attempt - 1);
}

async function deliverWithRetry(
  subscription: { id: string; url: string; secret: string },
  eventType: WebhookEvent,
  body: string,
): Promise<void> {
  let lastResult: DeliveryResult | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    lastResult = await attemptDelivery(subscription, eventType, body);
    if (lastResult.status === 'success') {
      await prisma.webhookDelivery.create({
        data: {
          subscriptionId: subscription.id,
          eventType,
          payload: body,
          status: 'success',
          statusCode: lastResult.statusCode,
          responseBody: lastResult.responseBody,
          attempts: attempt,
        },
      });
      return;
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
    }
  }
  await prisma.webhookDelivery.create({
    data: {
      subscriptionId: subscription.id,
      eventType,
      payload: body,
      status: 'failed',
      statusCode: lastResult?.statusCode ?? null,
      responseBody: lastResult?.responseBody ?? null,
      attempts: MAX_ATTEMPTS,
    },
  });
}

export function registerWebhookDispatcher(): void {
  if (registered) return;
  registered = true;

  for (const eventType of WEBHOOK_EVENTS) {
    eventBus.on(eventType as DomainEvent['type'], async (event) => {
      const subs = await webhooksService.findActiveForEvent(eventType);
      if (!subs.length) return;
      const body = JSON.stringify(buildPayload(event));
      await Promise.all(subs.map((sub) => deliverWithRetry(sub, eventType, body)));
    });
  }
}

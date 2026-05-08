import { prisma } from '../../db/prisma';
import { eventBus, type DomainEvent } from '../../events/bus';
import { webhooksService, WEBHOOK_EVENTS, type WebhookEvent } from './webhooks.service';

let registered = false;

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

async function deliver(
  subscription: { id: string; url: string; secret: string },
  eventType: WebhookEvent,
  body: string,
): Promise<{ status: 'success' | 'failed'; statusCode: number | null; responseBody: string | null }> {
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

export function registerWebhookDispatcher(): void {
  if (registered) return;
  registered = true;

  for (const eventType of WEBHOOK_EVENTS) {
    eventBus.on(eventType as DomainEvent['type'], async (event) => {
      const subs = await webhooksService.findActiveForEvent(eventType);
      if (!subs.length) return;
      const body = JSON.stringify(buildPayload(event));
      await Promise.all(
        subs.map(async (sub) => {
          const result = await deliver(sub, eventType, body);
          await prisma.webhookDelivery.create({
            data: {
              subscriptionId: sub.id,
              eventType,
              payload: body,
              status: result.status,
              statusCode: result.statusCode,
              responseBody: result.responseBody,
              attempts: 1,
            },
          });
        }),
      );
    });
  }
}

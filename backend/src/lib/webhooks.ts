import crypto from "node:crypto";
import { prisma } from "../prisma";

export const WEBHOOK_EVENTS = [
  "task_created",
  "task_updated",
  "project_created",
  "project_updated",
  "form_submitted",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

export function signWebhookBody(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function deliver(
  subscription: { id: string; url: string; secret: string },
  event: WebhookEvent,
  body: string,
) {
  const signature = signWebhookBody(subscription.secret, body);
  let status: number | null = null;
  let ok = false;
  let error: string | null = null;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "project-manager-webhook/1.0",
        "X-PM-Event": event,
        "X-PM-Signature": `sha256=${signature}`,
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    status = res.status;
    ok = res.ok;
    if (!ok) error = `non-2xx: ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await prisma.webhookDelivery.create({
    data: {
      subscriptionId: subscription.id,
      event,
      status,
      ok,
      error,
    },
  });
}

// Fire-and-forget. Errors are caught and logged into webhook_deliveries.
export function dispatchWebhook(event: WebhookEvent, payload: unknown) {
  void (async () => {
    const subs = await prisma.webhookSubscription.findMany({
      where: { isActive: true, events: { has: event } },
    });
    if (subs.length === 0) return;
    const body = JSON.stringify({
      event,
      deliveredAt: new Date().toISOString(),
      data: payload,
    });
    await Promise.all(
      subs.map((s) =>
        deliver({ id: s.id, url: s.url, secret: s.secret }, event, body).catch(
          (e) =>
            // eslint-disable-next-line no-console
            console.error("[webhook] delivery error", e),
        ),
      ),
    );
  })().catch((e) =>
    // eslint-disable-next-line no-console
    console.error("[webhook] dispatch error", e),
  );
}

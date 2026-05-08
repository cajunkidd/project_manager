import { describe, expect, it } from "vitest";
import { generateWebhookSecret, signWebhookBody, WEBHOOK_EVENTS } from "./webhooks";

describe("webhooks helpers", () => {
  it("generateWebhookSecret returns whsec_-prefixed secrets", () => {
    const s = generateWebhookSecret();
    expect(s).toMatch(/^whsec_/);
    expect(s.length).toBeGreaterThan(20);
  });

  it("signWebhookBody is deterministic for identical input", () => {
    const sig1 = signWebhookBody("whsec_abc", '{"event":"task_created"}');
    const sig2 = signWebhookBody("whsec_abc", '{"event":"task_created"}');
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signWebhookBody changes when the body changes", () => {
    const a = signWebhookBody("whsec_abc", '{"event":"task_created"}');
    const b = signWebhookBody("whsec_abc", '{"event":"task_updated"}');
    expect(a).not.toBe(b);
  });

  it("signWebhookBody changes when the secret changes", () => {
    const a = signWebhookBody("whsec_one", "body");
    const b = signWebhookBody("whsec_two", "body");
    expect(a).not.toBe(b);
  });

  it("matches the canonical OpenSSL HMAC-SHA256 output", () => {
    // Reference value computed with: printf '%s' "hello" | openssl dgst -sha256 -hmac "key"
    const expected =
      "9307b3b915efb5171ff14d8cb55fbcc798c6c0ef1456d66ded1a6aa723a58b7b";
    expect(signWebhookBody("key", "hello")).toBe(expected);
  });

  it("WEBHOOK_EVENTS exports the documented event names", () => {
    expect(WEBHOOK_EVENTS).toContain("task_created");
    expect(WEBHOOK_EVENTS).toContain("task_updated");
    expect(WEBHOOK_EVENTS).toContain("project_created");
    expect(WEBHOOK_EVENTS).toContain("project_updated");
    expect(WEBHOOK_EVENTS).toContain("form_submitted");
  });
});

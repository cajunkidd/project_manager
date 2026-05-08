import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./tokens";

describe("tokens", () => {
  it("generates pm_-prefixed tokens with the expected structure", () => {
    const { token, prefix, hash } = generateToken();
    expect(token).toMatch(/^pm_/);
    expect(token.length).toBeGreaterThan(40);
    expect(prefix).toBe(token.slice(0, 10));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashToken is deterministic and matches generateToken's hash", () => {
    const { token, hash } = generateToken();
    expect(hashToken(token)).toBe(hash);
    expect(hashToken("pm_known")).toBe(hashToken("pm_known"));
  });

  it("issues unique tokens per call", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 32; i++) {
      const { token } = generateToken();
      expect(seen.has(token)).toBe(false);
      seen.add(token);
    }
  });
});

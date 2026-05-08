import { describe, expect, it } from "vitest";
import { extractMentionTokens } from "./mentions";

describe("extractMentionTokens", () => {
  it("extracts a single @-token", () => {
    expect(extractMentionTokens("hey @alice can you take this?")).toEqual([
      "alice",
    ]);
  });

  it("dedupes repeated tokens and lowercases them", () => {
    expect(
      extractMentionTokens("@Alice and @alice and @ALICE all match"),
    ).toEqual(["alice"]);
  });

  it("supports multiple distinct tokens", () => {
    expect(
      extractMentionTokens("ping @bob.smith and @carol_lee for review"),
    ).toEqual(["bob.smith", "carol_lee"]);
  });

  it("documents the email-substring edge case", () => {
    // Known wart: a literal email address contains an @, so the domain part
    // gets parsed as a mention token. Resolving it against the user roster
    // typically returns no match, but it's worth knowing.
    expect(extractMentionTokens("contact alice@example.com")).toEqual([
      "example.com",
    ]);
  });

  it("returns empty array when no mentions", () => {
    expect(extractMentionTokens("nothing to see here")).toEqual([]);
  });
});

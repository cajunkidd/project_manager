import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "../middleware/error";

let cachedClient: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(
      503,
      "anthropic_api_key_missing: set ANTHROPIC_API_KEY to enable AI features",
    );
  }
  if (!cachedClient) {
    cachedClient = new Anthropic();
  }
  return cachedClient;
}

export const AI_MODEL = "claude-opus-4-7";

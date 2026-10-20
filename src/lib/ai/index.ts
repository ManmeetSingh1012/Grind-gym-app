import "server-only";
import type { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { serverEnv } from "@/lib/env";
import { createAnthropicProvider } from "./providers/anthropic";
import { createOpenAiProvider } from "./providers/openai";
import type { AiProvider, StructuredRequest } from "./types";

export type { AiImage, StructuredRequest } from "./types";

let provider: AiProvider | undefined;

/**
 * Picks the AI provider from env: AI_PROVIDER wins; otherwise whichever key is set
 * (OpenAI first). Features call `generateStructured` and never see the provider.
 */
function getProvider(): AiProvider {
  if (provider) return provider;
  const env = serverEnv();
  const choice = env.AI_PROVIDER ?? (env.OPENAI_API_KEY ? "openai" : env.ANTHROPIC_API_KEY ? "anthropic" : null);

  if (choice === "openai" && env.OPENAI_API_KEY) {
    provider = createOpenAiProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL);
  } else if (choice === "anthropic" && env.ANTHROPIC_API_KEY) {
    provider = createAnthropicProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
  } else {
    throw new ApiError(503, "ai_unavailable", "AI is not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.");
  }
  return provider;
}

export function generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
  return getProvider().generateStructured(req);
}

/** Model id recorded alongside stored AI reports. */
export function aiModel() {
  return getProvider().model;
}

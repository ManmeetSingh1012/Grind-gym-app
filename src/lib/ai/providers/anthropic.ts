import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { AiProvider, StructuredRequest } from "../types";

export function createAnthropicProvider(apiKey: string, model: string): AiProvider {
  const client = new Anthropic({ apiKey });

  return {
    model,
    async generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
      const content: Anthropic.Beta.BetaContentBlockParam[] | string =
        typeof req.content === "string"
          ? req.content
          : [
              ...req.content.images.map((img) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
              })),
              { type: "text" as const, text: req.content.text },
            ];
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
      const tools: Anthropic.Beta.BetaToolUnion[] | undefined = req.webSearch
        ? [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }]
        : undefined;

      try {
        // Server tools can pause a long turn; resume a couple of times before giving up.
        for (let attempt = 0; attempt < 3; attempt++) {
          const response = await client.beta.messages.parse({
            model,
            max_tokens: req.maxTokens ?? 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: req.system,
            messages,
            tools,
            output_config: { effort: req.effort ?? "medium", format: betaZodOutputFormat(req.schema) },
          });

          if (response.stop_reason === "pause_turn") {
            messages.push({ role: "assistant", content: response.content });
            continue;
          }
          if (response.stop_reason === "refusal") {
            throw new ApiError(422, "bad_request", "The AI declined this request. Try rephrasing it.");
          }
          if (response.stop_reason === "max_tokens" || response.parsed_output == null) {
            throw new ApiError(502, "upstream_error", "The AI response was incomplete. Please try again.");
          }
          return response.parsed_output;
        }
        throw new ApiError(502, "upstream_error", "The AI took too long to answer. Please try again.");
      } catch (err) {
        throw toApiError(err);
      }
    },
  };
}

function toApiError(err: unknown): unknown {
  if (err instanceof ApiError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new ApiError(503, "ai_unavailable", "AI key is invalid.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ApiError(429, "upstream_error", "AI is busy right now. Try again in a moment.");
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("[ai:anthropic] bad request", err.message);
    return new ApiError(502, "upstream_error", "AI request was rejected.");
  }
  if (err instanceof Anthropic.APIError) {
    console.error("[ai:anthropic] api error", err.status, err.message);
    return new ApiError(502, "upstream_error", "AI service error. Please try again.");
  }
  return err;
}

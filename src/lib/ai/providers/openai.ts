import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { AiProvider, StructuredRequest } from "../types";

/** OpenAI Responses API: structured outputs via zod, built-in web search, image input. */
export function createOpenAiProvider(apiKey: string, model: string): AiProvider {
  const client = new OpenAI({ apiKey });

  return {
    model,
    async generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
      const content: OpenAI.Responses.ResponseInputContent[] =
        typeof req.content === "string"
          ? [{ type: "input_text", text: req.content }]
          : [
              ...req.content.images.map((img) => ({
                type: "input_image" as const,
                detail: "high" as const,
                image_url: `data:${img.mediaType};base64,${img.base64}`,
              })),
              { type: "input_text" as const, text: req.content.text },
            ];

      try {
        const response = await client.responses.parse({
          model,
          instructions: req.system,
          input: [{ role: "user", content }],
          tools: req.webSearch ? [{ type: "web_search" }] : undefined,
          reasoning: { effort: req.effort ?? "medium" },
          max_output_tokens: req.maxTokens ?? 16000,
          text: { format: zodTextFormat(req.schema, req.name) },
        });

        if (response.status === "incomplete") {
          throw new ApiError(502, "upstream_error", "The AI response was incomplete. Please try again.");
        }
        const refused = response.output.some(
          (item) => item.type === "message" && item.content.some((c) => c.type === "refusal"),
        );
        if (refused) throw new ApiError(422, "bad_request", "The AI declined this request. Try rephrasing it.");
        if (response.output_parsed == null) {
          throw new ApiError(502, "upstream_error", "The AI returned an unexpected answer. Please try again.");
        }
        return response.output_parsed as z.infer<T>;
      } catch (err) {
        throw toApiError(err);
      }
    },
  };
}

function toApiError(err: unknown): unknown {
  if (err instanceof ApiError) return err;
  if (err instanceof OpenAI.AuthenticationError) {
    return new ApiError(503, "ai_unavailable", "OpenAI key is invalid.");
  }
  if (err instanceof OpenAI.RateLimitError) {
    // 429 also covers "insufficient_quota" (no API credits on the account).
    console.error("[ai:openai] rate limit / quota", err.message);
    return new ApiError(429, "upstream_error", "AI quota or rate limit reached. Check your OpenAI API billing.");
  }
  if (err instanceof OpenAI.BadRequestError) {
    console.error("[ai:openai] bad request", err.message);
    return new ApiError(502, "upstream_error", "AI request was rejected.");
  }
  if (err instanceof OpenAI.APIError) {
    console.error("[ai:openai] api error", err.status, err.message);
    return new ApiError(502, "upstream_error", "AI service error. Please try again.");
  }
  return err;
}

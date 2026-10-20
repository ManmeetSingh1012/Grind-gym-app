import type { z } from "zod";

export type AiImage = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string };

/** Provider-neutral request for one structured (schema-validated) AI answer. */
export interface StructuredRequest<T extends z.ZodType> {
  schema: T;
  /** Short identifier for the schema (used by providers that name their JSON schemas). */
  name: string;
  system: string;
  content: string | { text: string; images: AiImage[] };
  /** Let the model search the web before answering (exercise lookup etc). */
  webSearch?: boolean;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface AiProvider {
  readonly model: string;
  generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>>;
}

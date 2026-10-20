import "server-only";
import { z } from "zod";

// Treat `KEY=` (empty) the same as an unset variable.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  AI_PROVIDER: optional(z.enum(["openai", "anthropic"])),
  OPENAI_API_KEY: optional(z.string().min(1)),
  OPENAI_MODEL: optional(z.string()).transform((v) => v ?? "gpt-6-luna"),
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  ANTHROPIC_MODEL: optional(z.string()).transform((v) => v ?? "claude-opus-5-5"),
  USDA_API_KEY: optional(z.string()).transform((v) => v ?? "DEMO_KEY"),
});

let cached: z.infer<typeof serverEnvSchema> | undefined;

/** Validated server-side environment. Throws once, loudly, on misconfiguration. */
export function serverEnv() {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}

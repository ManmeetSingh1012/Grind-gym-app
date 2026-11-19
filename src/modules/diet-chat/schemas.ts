import { z } from "zod";
import { parsedMealSchema } from "@/modules/nutrition/schemas";

export const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof chatMessage>;

export const dietChatInput = z.object({
  /** Whole conversation so far, oldest first; the last message is the user's new one. */
  messages: z.array(chatMessage).min(1).max(40),
  /** The user's local date, so "today" matches their phone, not the server. */
  date: z.iso.date().optional(),
});
export type DietChatInput = z.infer<typeof dietChatInput>;

/** What the diet coach answers with. `foods` is filled only when the user says they ate something. */
export const dietChatReplySchema = z.object({
  reply: z
    .string()
    .describe("Your answer to the user: short, friendly, practical, plain text (no markdown tables). 1-6 sentences or a short list."),
  foods: parsedMealSchema.shape.items.describe(
    "Foods the user says they ATE or are eating now, itemised with full nutrition, ready to log. Empty for questions, plans or ideas.",
  ),
  meal: parsedMealSchema.shape.meal,
});
export type DietChatReply = z.infer<typeof dietChatReplySchema>;

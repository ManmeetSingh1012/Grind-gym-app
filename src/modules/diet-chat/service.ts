import "server-only";
import { generateStructured } from "@/lib/ai";
import { toIsoDate } from "@/lib/dates";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { activeGoal } from "@/modules/goals/service";
import { daySummary } from "@/modules/nutrition/service";
import { getProfile } from "@/modules/profile/service";
import { dietChatReplySchema, type DietChatInput, type DietChatReply } from "./schemas";

const SYSTEM = `You are "Grind Coach", a no-nonsense but supportive diet and nutrition coach inside a gym tracking app.
Scope: ONLY food, diet, nutrition, hydration, supplements and how eating supports training. If the user asks about
anything else, say in one line that you only handle diet for now and steer back.
Use the user's live data (profile, goal, today's targets, what they've logged) to give specific numbers: calories and
protein left, what to eat next, swaps, Indian and international meal ideas with portions. Be concise and direct.
The user may write in English or Hinglish and may dictate by voice, so the text can be imperfect; reply in the same style.
If the user says they ate or are eating something, itemise it in "foods" with realistic portions and full nutrition
(USDA / IFCT style values; vitamin A, D, K, B12, folate, selenium in micrograms) so the app can log it, and mention the
total in your reply. Never put foods in "foods" for questions, plans or suggestions. Not medical advice: for medical
conditions suggest seeing a doctor or dietitian.`;

export async function dietChat(db: SupabaseServerClient, userId: string, input: DietChatInput): Promise<DietChatReply> {
  const date = input.date ?? toIsoDate();
  const [summary, profile, goal] = await Promise.all([
    daySummary(db, userId, date),
    getProfile(db, userId).catch(() => null),
    activeGoal(db).catch(() => null),
  ]);

  const context = {
    date,
    profile: profile && {
      name: profile.display_name,
      sex: profile.sex,
      birth_date: profile.birth_date,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      activity_level: profile.activity_level,
    },
    goal: goal && { type: goal.type, title: goal.title },
    targets: {
      calories: summary.targets.calories,
      protein_g: summary.targets.protein_g,
      carbs_g: summary.targets.carbs_g,
      fat_g: summary.targets.fat_g,
    },
    eaten_today: {
      calories: summary.totals.calories,
      protein_g: summary.totals.protein_g,
      carbs_g: summary.totals.carbs_g,
      fat_g: summary.totals.fat_g,
    },
    remaining_today: {
      calories: Math.round(summary.targets.calories - summary.totals.calories),
      protein_g: Math.round(summary.targets.protein_g - summary.totals.protein_g),
    },
    logged_foods: summary.logs.map((l) => `${l.meal}: ${l.name} (${l.quantity} ${l.unit}, ${Math.round(l.calories)} kcal)`),
  };

  const transcript = input.messages
    .slice(-20)
    .map((m) => `${m.role === "user" ? "USER" : "COACH"}: ${m.content}`)
    .join("\n\n");

  return generateStructured({
    schema: dietChatReplySchema,
    name: "diet_chat_reply",
    system: SYSTEM,
    content: `USER DATA (live from the app):\n${JSON.stringify(context, null, 2)}\n\nCONVERSATION (answer the last USER message):\n${transcript}`,
    effort: "low",
    maxTokens: 8000,
  });
}

import "server-only";
import { z } from "zod";
import { toIsoDate } from "@/lib/dates";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { latestInsights } from "@/modules/coach/service";
import { dietChat } from "@/modules/diet-chat/service";
import { searchExercises } from "@/modules/exercises/service";
import { listGoals } from "@/modules/goals/service";
import { mealType, microsSchema, updateFoodLogInput } from "@/modules/nutrition/schemas";
import { createFoodLogs, daySummary, deleteFoodLog, parseMealWithAi, saveTargets, updateFoodLog } from "@/modules/nutrition/service";
import { getProfile } from "@/modules/profile/service";
import { exerciseHistory, listRoutine, logSets } from "@/modules/workouts/service";

export type ToolContext = { supabase: SupabaseServerClient; userId: string };

type Tool<S extends z.ZodObject> = {
  name: string;
  title: string;
  description: string;
  input: S;
  readOnly?: boolean;
  run: (ctx: ToolContext, args: z.infer<S>) => Promise<unknown>;
};

const tool = <S extends z.ZodObject>(t: Tool<S>) => t as unknown as Tool<z.ZodObject>;

const date = z.iso.date().optional().describe("YYYY-MM-DD. Defaults to today.");
const weekday = z.number().int().min(1).max(7).describe("1 = Monday … 7 = Sunday");
const isoWeekday = (iso: string) => ((new Date(`${iso}T00:00:00`).getDay() + 6) % 7) + 1;

/** Everything an outside AI (Claude Desktop, Cursor, ChatGPT…) can do in Grind, scoped to the signed-in user. */
export const TOOLS = [
  tool({
    name: "get_profile",
    title: "Get profile & goals",
    description: "The user's profile (sex, age, height, weight, activity level) and their fitness goals.",
    input: z.object({}),
    readOnly: true,
    run: async ({ supabase, userId }) => ({ profile: await getProfile(supabase, userId), goals: await listGoals(supabase) }),
  }),
  tool({
    name: "get_nutrition_day",
    title: "Get a day of food",
    description: "Calorie/macro/micronutrient targets, totals eaten and every food logged on a date (with log ids for editing).",
    input: z.object({ date }),
    readOnly: true,
    run: ({ supabase, userId }, a) => daySummary(supabase, userId, a.date ?? toIsoDate()),
  }),
  tool({
    name: "log_meal",
    title: "Log a meal from text",
    description:
      'Describe what was eaten in plain words (e.g. "2 rotis, dal and a bowl of curd"). AI estimates nutrition per item and logs it.',
    input: z.object({
      text: z.string().min(2).max(1000),
      meal: mealType.optional().describe("breakfast | lunch | dinner | snack. Guessed from the text if omitted."),
      date,
    }),
    run: async ({ supabase }, a) => {
      const parsed = await parseMealWithAi(a.text);
      if (!parsed.items.length) return { logged: [], note: "No foods recognised in the text." };
      const logged = await createFoodLogs(
        supabase,
        parsed.items.map(({ grams_total: _, ...item }) => ({
          ...item,
          eaten_on: a.date ?? toIsoDate(),
          meal: a.meal ?? parsed.meal,
          source: "ai" as const,
        })),
      );
      return { logged, total_calories: logged.reduce((s, l) => s + l.calories, 0) };
    },
  }),
  tool({
    name: "log_food",
    title: "Log a food with exact numbers",
    description: "Log one food with known calories and macros (no AI estimate).",
    input: z.object({
      name: z.string().min(1).max(120),
      calories: z.number().min(0).max(10000),
      protein_g: z.number().min(0).max(1000).default(0),
      carbs_g: z.number().min(0).max(2000).default(0),
      fat_g: z.number().min(0).max(1000).default(0),
      quantity: z.number().positive().max(10000).default(1),
      unit: z.string().max(30).default("serving"),
      meal: mealType.default("snack"),
      micros: microsSchema.default({}),
      date,
    }),
    run: ({ supabase }, { date: d, ...food }) =>
      createFoodLogs(supabase, [{ ...food, eaten_on: d ?? toIsoDate(), source: "manual" }]),
  }),
  tool({
    name: "update_food_log",
    title: "Edit a logged food",
    description: "Change a logged food's calories, macros, quantity, name or meal. Get ids from get_nutrition_day.",
    input: updateFoodLogInput.extend({ id: z.uuid() }),
    run: ({ supabase }, { id, ...input }) => updateFoodLog(supabase, id, input),
  }),
  tool({
    name: "delete_food_log",
    title: "Delete a logged food",
    description: "Remove a food log by id.",
    input: z.object({ id: z.uuid() }),
    run: async ({ supabase }, a) => {
      await deleteFoodLog(supabase, a.id);
      return { deleted: a.id };
    },
  }),
  tool({
    name: "set_nutrition_targets",
    title: "Set daily calorie & macro targets",
    description: "Set custom daily targets. Omitted fields keep their current value.",
    input: z.object({
      calories: z.number().min(800).max(10000).optional(),
      protein_g: z.number().min(0).max(1000).optional(),
      carbs_g: z.number().min(0).max(2000).optional(),
      fat_g: z.number().min(0).max(1000).optional(),
    }),
    run: ({ supabase, userId }, a) => saveTargets(supabase, userId, a, "manual"),
  }),
  tool({
    name: "diet_coach",
    title: "Ask the diet coach",
    description:
      "Ask Grind's diet coach a nutrition question. It sees the user's targets and today's food. Returns a reply and any foods it detected as eaten (not logged automatically).",
    input: z.object({ message: z.string().min(1).max(4000), date }),
    readOnly: true,
    run: ({ supabase, userId }, a) => dietChat(supabase, userId, { messages: [{ role: "user", content: a.message }], date: a.date }),
  }),
  tool({
    name: "get_workout_day",
    title: "Get a workout day",
    description:
      "Exercises planned for a weekday with today's logged sets, last session, best set and estimated 1RM. Use exercise ids from here to log sets.",
    input: z.object({ weekday: weekday.optional().describe("Defaults to the weekday of `date`."), date }),
    readOnly: true,
    run: ({ supabase }, a) => {
      const d = a.date ?? toIsoDate();
      return listRoutine(supabase, a.weekday ?? isoWeekday(d), d);
    },
  }),
  tool({
    name: "search_exercises",
    title: "Search exercises",
    description: "Find exercises in the library by name to get their ids.",
    input: z.object({ query: z.string().max(100), limit: z.number().int().min(1).max(50).default(10) }),
    readOnly: true,
    run: ({ supabase }, a) => searchExercises(supabase, a.query, a.limit),
  }),
  tool({
    name: "log_sets",
    title: "Log workout sets",
    description: "Log one or more sets (weight in kg × reps) for an exercise. Set numbers continue after today's existing sets.",
    input: z.object({
      exercise_id: z.uuid(),
      sets: z.array(z.object({ weight_kg: z.number().min(0).max(1000), reps: z.number().int().min(0).max(500) })).min(1).max(30),
      date,
    }),
    run: ({ supabase }, a) =>
      logSets(
        supabase,
        a.sets.map((s) => ({ ...s, exercise_id: a.exercise_id, performed_on: a.date ?? toIsoDate() })),
      ),
  }),
  tool({
    name: "get_exercise_history",
    title: "Get exercise history",
    description: "All sessions, personal records and per-weight bests for one exercise.",
    input: z.object({ exercise_id: z.uuid() }),
    readOnly: true,
    run: ({ supabase }, a) => exerciseHistory(supabase, a.exercise_id),
  }),
  tool({
    name: "get_coach_insights",
    title: "Get latest coach insights",
    description: "The most recent AI training analysis (trends and next-session targets per exercise), if one exists.",
    input: z.object({}),
    readOnly: true,
    run: ({ supabase }) => latestInsights(supabase),
  }),
];

export function toolList() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: z.toJSONSchema(t.input, { io: "input" }),
    annotations: { title: t.title, readOnlyHint: !!t.readOnly, destructiveHint: t.name.startsWith("delete") },
  }));
}

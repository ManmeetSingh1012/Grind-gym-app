import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import { notFound } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/handler";
import { toIsoDate } from "@/lib/dates";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { latestScan } from "@/modules/body/service";
import { GOAL_LABELS, type GoalType } from "@/modules/goals/schemas";
import { activeGoal, createGoal, updateGoal } from "@/modules/goals/service";
import { getProfile } from "@/modules/profile/service";
import { MICRO_KEYS, round } from "./nutrients";
import {
  foodLogSchema,
  nutritionTargetsSchema,
  parsedMealSchema,
  updateFoodLogInput,
  updateTargetsInput,
  type CreateFoodLogInput,
  type DaySummary,
  type FoodLog,
  type NutritionTargets,
  type NutritionTotals,
  type Pace,
  type ParsedMeal,
} from "./schemas";
import { calculateTargets } from "./targets";

const parseLogs = (rows: unknown) => z.array(foodLogSchema).parse(rows);

export async function listFoodLogs(db: SupabaseServerClient, date: string): Promise<FoodLog[]> {
  return parseLogs(unwrap(await db.from("food_logs").select("*").eq("eaten_on", date).order("created_at")));
}

export async function createFoodLogs(db: SupabaseServerClient, items: CreateFoodLogInput[]): Promise<FoodLog[]> {
  const rows = items.map((i) => ({ ...i, eaten_on: i.eaten_on ?? toIsoDate() }));
  return parseLogs(unwrap(await db.from("food_logs").insert(rows).select("*")));
}

export async function updateFoodLog(db: SupabaseServerClient, id: string, input: z.infer<typeof updateFoodLogInput>) {
  const row = unwrap(await db.from("food_logs").update(input).eq("id", id).select("*").maybeSingle());
  if (!row) throw notFound("Food entry");
  return foodLogSchema.parse(row);
}

export async function deleteFoodLog(db: SupabaseServerClient, id: string) {
  unwrap(await db.from("food_logs").delete().eq("id", id));
}

// ---- Targets --------------------------------------------------------------

/**
 * The user's daily targets. Calculated targets are recomputed on every read from the saved
 * goal + pace, so a new scan or weight flows through automatically; AI-plan and manual
 * targets are fixed numbers. Without saved targets, the active goal at moderate pace is used.
 */
export async function getTargets(db: SupabaseServerClient, userId: string): Promise<NutritionTargets> {
  const row = unwrap(await db.from("nutrition_targets").select("*").eq("user_id", userId).maybeSingle());
  const stored = row ? nutritionTargetsSchema.parse(row) : null;

  if (!stored || stored.source === "calculated") {
    return computeTargets(db, userId, { goal: stored?.goal_type, pace: stored?.pace });
  }
  const computed = await computeTargets(db, userId);
  // Fill any micronutrient the stored targets don't cover.
  return { ...stored, micros: { ...computed.micros, ...stored.micros } };
}

export async function computeTargets(
  db: SupabaseServerClient,
  userId: string,
  choice: { goal?: GoalType | null; pace?: Pace | null } = {},
) {
  const [profile, goal, scan] = await Promise.all([getProfile(db, userId), activeGoal(db), latestScan(db)]);
  return calculateTargets({ profile, goal: choice.goal ?? goal?.type, pace: choice.pace, scan });
}

/**
 * Preview (or save) targets for a goal + pace. Saving also makes that goal type the
 * active goal, so the AI plan and coach aim at the same thing.
 */
export async function calculateAndMaybeSave(
  db: SupabaseServerClient,
  userId: string,
  input: { goal: GoalType; pace: Pace; save: boolean },
): Promise<NutritionTargets> {
  const targets = await computeTargets(db, userId, input);
  if (!input.save) return targets;

  unwrap(
    await db.from("nutrition_targets").upsert({
      user_id: userId,
      calories: targets.calories,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      micros: targets.micros,
      source: "calculated",
      goal_type: input.goal,
      pace: targets.pace,
      calculation: targets.calculation,
    }),
  );

  const goal = await activeGoal(db);
  if (!goal) await createGoal(db, { type: input.goal, title: GOAL_LABELS[input.goal], training_days: 6, is_active: true });
  else if (goal.type !== input.goal) await updateGoal(db, goal.id, { type: input.goal });

  return targets;
}

export async function saveTargets(
  db: SupabaseServerClient,
  userId: string,
  input: z.infer<typeof updateTargetsInput>,
  source: NutritionTargets["source"] = "manual",
) {
  const current = await getTargets(db, userId);
  // Fixed numbers from here on: drop the calculation so stale "working" isn't shown.
  const next = {
    ...current,
    ...input,
    micros: { ...current.micros, ...input.micros },
    source,
    calculation: null,
    user_id: userId,
  };
  return nutritionTargetsSchema.parse(
    unwrap(await db.from("nutrition_targets").upsert(next).select("*").single()),
  );
}

export async function resetTargets(db: SupabaseServerClient, userId: string) {
  unwrap(await db.from("nutrition_targets").delete().eq("user_id", userId));
  return computeTargets(db, userId);
}

// ---- Summary --------------------------------------------------------------

export function sumLogs(logs: FoodLog[]): NutritionTotals {
  const totals: NutritionTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, micros: {} };
  for (const l of logs) {
    totals.calories += l.calories;
    totals.protein_g += l.protein_g;
    totals.carbs_g += l.carbs_g;
    totals.fat_g += l.fat_g;
    for (const k of MICRO_KEYS) totals.micros[k] = (totals.micros[k] ?? 0) + (l.micros[k] ?? 0);
  }
  totals.calories = round(totals.calories, 0);
  totals.protein_g = round(totals.protein_g, 1);
  totals.carbs_g = round(totals.carbs_g, 1);
  totals.fat_g = round(totals.fat_g, 1);
  for (const k of MICRO_KEYS) totals.micros[k] = round(totals.micros[k] ?? 0);
  return totals;
}

export async function daySummary(db: SupabaseServerClient, userId: string, date: string): Promise<DaySummary> {
  const [logs, targets] = await Promise.all([listFoodLogs(db, date), getTargets(db, userId)]);
  return { date, logs, totals: sumLogs(logs), targets };
}

// ---- AI parsing -------------------------------------------------------------

const PARSE_SYSTEM = `You are a precise nutrition analyst. The user describes what they ate, typed or dictated by voice
(transcription may be imperfect). Split it into individual food items, infer realistic portion sizes when not given
(use typical Indian and international serving sizes as appropriate), and estimate full nutrition for each item's whole
portion using USDA / IFCT style reference values. Fill every micronutrient field with your best estimate (0 if truly none).
Units: vitamin A, D, K, B12, folate, selenium in micrograms; the rest as named in the field.`;

export async function parseMealWithAi(text: string): Promise<ParsedMeal> {
  return generateStructured({ schema: parsedMealSchema, name: "parsed_meal", system: PARSE_SYSTEM, content: text, effort: "low" });
}

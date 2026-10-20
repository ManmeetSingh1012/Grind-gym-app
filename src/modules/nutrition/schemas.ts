import { z } from "zod";
import { goalType } from "@/modules/goals/schemas";
import { activityLevel } from "@/modules/profile/schemas";
import { MICRO_KEYS } from "./nutrients";

export const mealType = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type MealType = z.infer<typeof mealType>;
export const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const microsSchema = z.partialRecord(z.enum(MICRO_KEYS), z.number().min(0));

export const foodLogSchema = z.object({
  id: z.uuid(),
  eaten_on: z.string(),
  meal: mealType,
  name: z.string(),
  quantity: z.coerce.number(),
  unit: z.string(),
  calories: z.coerce.number(),
  protein_g: z.coerce.number(),
  carbs_g: z.coerce.number(),
  fat_g: z.coerce.number(),
  micros: microsSchema,
  source: z.enum(["manual", "ai", "usda"]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FoodLog = z.infer<typeof foodLogSchema>;

const foodLogFields = z.object({
  eaten_on: z.iso.date(),
  meal: mealType,
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(10000),
  unit: z.string().trim().max(30),
  calories: z.number().min(0).max(10000),
  protein_g: z.number().min(0).max(1000),
  carbs_g: z.number().min(0).max(2000),
  fat_g: z.number().min(0).max(1000),
  micros: microsSchema,
  source: z.enum(["manual", "ai", "usda"]),
});

export const createFoodLogInput = foodLogFields.extend({
  eaten_on: foodLogFields.shape.eaten_on.optional(),
  meal: mealType.default("snack"),
  quantity: foodLogFields.shape.quantity.default(1),
  unit: foodLogFields.shape.unit.default("serving"),
  micros: microsSchema.default({}),
  source: foodLogFields.shape.source.default("manual"),
});
export type CreateFoodLogInput = z.infer<typeof createFoodLogInput>;
export const createFoodLogsInput = z.object({ items: z.array(createFoodLogInput).min(1).max(30) });
// Built from the default-free fields: zod's .partial() keeps defaults, which would reset omitted fields on PATCH.
export const updateFoodLogInput = foodLogFields.partial();

export const dateQuery = z.object({ date: z.iso.date().optional() });

export const pace = z.enum(["slow", "moderate", "fast"]);
export type Pace = z.infer<typeof pace>;

/** How calculated targets were derived; shown to the user as the "working". */
export const targetCalculationSchema = z.object({
  goal: goalType,
  pace: pace.nullable(),
  bmr: z.number(),
  bmr_source: z.enum(["scan", "formula"]),
  scan_date: z.string().nullable(),
  activity_level: activityLevel,
  activity_factor: z.number(),
  maintenance: z.number(),
  adjustment: z.number(),
  weekly_change_kg: z.number().nullable(),
  floored: z.boolean(),
  weight_kg: z.number(),
  lean_mass_kg: z.number().nullable(),
  protein_per_kg: z.number(),
  missing_profile: z.array(z.string()),
});
export type TargetCalculation = z.infer<typeof targetCalculationSchema>;

export const nutritionTargetsSchema = z.object({
  calories: z.coerce.number(),
  protein_g: z.coerce.number(),
  carbs_g: z.coerce.number(),
  fat_g: z.coerce.number(),
  micros: microsSchema,
  source: z.enum(["calculated", "ai_plan", "manual"]),
  goal_type: goalType.nullish(),
  pace: pace.nullish(),
  calculation: targetCalculationSchema.nullish(),
});
export type NutritionTargets = z.infer<typeof nutritionTargetsSchema>;
export const updateTargetsInput = nutritionTargetsSchema
  .pick({ calories: true, protein_g: true, carbs_g: true, fat_g: true, micros: true })
  .partial();

export const calculateTargetsInput = z.object({
  goal: goalType,
  pace: pace.default("moderate"),
  /** false = preview only; true = save as the daily targets and make it the active goal. */
  save: z.boolean().default(false),
});

export type NutritionTotals = Pick<FoodLog, "calories" | "protein_g" | "carbs_g" | "fat_g"> & {
  micros: Record<string, number>;
};
export type DaySummary = { date: string; totals: NutritionTotals; targets: NutritionTargets; logs: FoodLog[] };

// ---- Food search / AI parsing --------------------------------------------

export const foodSearchQuery = z.object({ q: z.string().trim().min(2).max(100) });

/** A food candidate the user can log; nutrients are for `quantity` `unit`. */
export type FoodCandidate = Omit<CreateFoodLogInput, "eaten_on" | "meal"> & {
  ref?: string;
  /** Grams in one `unit`, when known, so the UI can rescale. */
  grams_per_unit?: number | null;
};

export const parseMealInput = z.object({ text: z.string().trim().min(2).max(1000) });

/** Structured shape Claude fills when parsing a free-text / spoken meal description. */
const microsForAi = z.object(Object.fromEntries(MICRO_KEYS.map((k) => [k, z.number()])) as Record<(typeof MICRO_KEYS)[number], z.ZodNumber>);
export const parsedMealSchema = z.object({
  meal: mealType.describe("Best guess of which meal this is, based on the text"),
  items: z.array(
    z.object({
      name: z.string().describe("Food name with preparation, e.g. 'Scrambled eggs'"),
      quantity: z.number(),
      unit: z.string().describe("e.g. g, ml, piece, cup, tbsp, slice, bowl"),
      grams_total: z.number().describe("Estimated total grams for this item"),
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      micros: microsForAi,
    }),
  ),
});
export type ParsedMeal = z.infer<typeof parsedMealSchema>;

import { z } from "zod";

export const goalType = z.enum(["lose_fat", "build_muscle", "recomp", "strength", "endurance", "maintain"]);
export type GoalType = z.infer<typeof goalType>;

export const GOAL_LABELS: Record<GoalType, string> = {
  lose_fat: "Lose fat",
  build_muscle: "Build muscle",
  recomp: "Recomposition (lose fat, gain muscle)",
  strength: "Get stronger",
  endurance: "Improve endurance",
  maintain: "Maintain",
};

export const goalSchema = z.object({
  id: z.uuid(),
  type: goalType,
  title: z.string(),
  target_weight_kg: z.coerce.number().nullable(),
  target_body_fat_pct: z.coerce.number().nullable(),
  target_date: z.string().nullable(),
  training_days: z.number(),
  notes: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Goal = z.infer<typeof goalSchema>;

const goalFields = z.object({
  type: goalType,
  title: z.string().trim().min(2).max(100),
  target_weight_kg: z.number().min(20).max(400).nullish(),
  target_body_fat_pct: z.number().min(2).max(60).nullish(),
  target_date: z.iso.date().nullish(),
  training_days: z.number().int().min(1).max(7),
  notes: z.string().trim().max(1000).nullish(),
  is_active: z.boolean(),
});

export const createGoalInput = goalFields.extend({
  training_days: goalFields.shape.training_days.default(6),
  is_active: goalFields.shape.is_active.default(true),
});
export type CreateGoalInput = z.infer<typeof createGoalInput>;

// From the default-free fields: zod's .partial() keeps defaults, which would reset omitted fields on PATCH.
export const updateGoalInput = goalFields.partial();
export type UpdateGoalInput = z.infer<typeof updateGoalInput>;

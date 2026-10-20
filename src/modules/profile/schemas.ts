import { z } from "zod";

export const activityLevel = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
export type ActivityLevel = z.infer<typeof activityLevel>;

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (desk job, little exercise)",
  light: "Light (1-3 workouts / week)",
  moderate: "Moderate (3-5 workouts / week)",
  active: "Active (6-7 workouts / week)",
  very_active: "Very active (hard training + physical job)",
};

export const profileSchema = z.object({
  id: z.uuid(),
  display_name: z.string().nullable(),
  sex: z.enum(["male", "female"]).nullable(),
  birth_date: z.string().nullable(),
  height_cm: z.coerce.number().nullable(),
  weight_kg: z.coerce.number().nullable(),
  activity_level: activityLevel,
});
export type Profile = z.infer<typeof profileSchema>;

export const updateProfileInput = z.object({
  display_name: z.string().trim().max(60).nullish(),
  sex: z.enum(["male", "female"]).nullish(),
  birth_date: z.iso.date().nullish(),
  height_cm: z.number().min(50).max(260).nullish(),
  weight_kg: z.number().min(20).max(400).nullish(),
  activity_level: activityLevel.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInput>;

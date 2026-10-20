import { z } from "zod";
import { exerciseCategory } from "@/modules/exercises/schemas";

export const SCAN_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const SCAN_MAX_BYTES = 8 * 1024 * 1024;

const metric = z.object({ label: z.string(), value: z.string(), unit: z.string().nullable() });

export const bodyScanSchema = z.object({
  id: z.uuid(),
  image_path: z.string().nullable(),
  scanned_on: z.string(),
  weight_kg: z.coerce.number().nullable(),
  body_fat_pct: z.coerce.number().nullable(),
  skeletal_muscle_kg: z.coerce.number().nullable(),
  fat_mass_kg: z.coerce.number().nullable(),
  visceral_fat_level: z.coerce.number().nullable(),
  bmr_kcal: z.number().nullable(),
  total_body_water_l: z.coerce.number().nullable(),
  metrics: z.object({ other: z.array(metric).optional() }).catchall(z.unknown()),
  created_at: z.string(),
});
export type BodyScan = z.infer<typeof bodyScanSchema> & { image_url?: string | null };

export const updateScanInput = z.object({
  scanned_on: z.iso.date(),
  weight_kg: z.number().min(20).max(400).nullable(),
  body_fat_pct: z.number().min(2).max(70).nullable(),
  skeletal_muscle_kg: z.number().min(5).max(150).nullable(),
  fat_mass_kg: z.number().min(0).max(300).nullable(),
  visceral_fat_level: z.number().min(0).max(60).nullable(),
  bmr_kcal: z.number().int().min(500).max(5000).nullable(),
  total_body_water_l: z.number().min(5).max(150).nullable(),
}).partial();
export type UpdateScanInput = z.infer<typeof updateScanInput>;

/** What Claude extracts from a body composition report image. */
export const extractedScanSchema = z.object({
  is_body_composition_report: z.boolean().describe("False if the image is not a body composition / InBody style report"),
  scanned_on: z.string().nullable().describe("Test date as YYYY-MM-DD if printed on the report"),
  weight_kg: z.number().nullable(),
  body_fat_pct: z.number().nullable(),
  skeletal_muscle_kg: z.number().nullable(),
  fat_mass_kg: z.number().nullable(),
  visceral_fat_level: z.number().nullable(),
  bmr_kcal: z.number().nullable(),
  total_body_water_l: z.number().nullable(),
  other: z.array(metric).describe("Every other value on the report: segmental lean/fat, ECW/TBW, BMI, score, protein, minerals, etc."),
});

// ---- AI plan ------------------------------------------------------------

export const planSchema = z.object({
  summary: z.string().describe("2-3 sentence overview of the plan and expected outcome"),
  assessment: z.object({
    current_state: z.string(),
    key_findings: z.array(z.string()),
  }),
  nutrition: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    hydration_l: z.number(),
    micro_focus: z.array(z.object({ nutrient: z.string(), target: z.string(), why: z.string() })),
    meal_plan: z.array(
      z.object({
        meal: z.string(),
        time: z.string(),
        foods: z.array(z.string()),
        calories: z.number(),
        protein_g: z.number(),
      }),
    ),
    tips: z.array(z.string()),
  }),
  training: z.object({
    split_name: z.string(),
    progression: z.string().describe("How to progress load/reps week to week"),
    days: z.array(
      z.object({
        weekday: z.number().int().describe("1=Monday … 7=Sunday"),
        focus: z.string(),
        exercises: z.array(
          z.object({
            name: z.string().describe("Standard exercise name, Title Case"),
            muscle_group: z.string(),
            category: exerciseCategory,
            sets: z.number().int(),
            reps: z.string().describe("e.g. '8-10' or '12'"),
            rest_sec: z.number().int(),
            notes: z.string(),
          }),
        ),
      }),
    ),
  }),
  cardio: z.object({
    daily_steps: z.number().int(),
    sessions: z.array(
      z.object({
        weekday: z.number().int(),
        type: z.string(),
        duration_min: z.number().int(),
        intensity: z.string().describe("e.g. 'Zone 2, 120-135 bpm' or 'HIIT 30s on / 60s off'"),
        notes: z.string(),
      }),
    ),
  }),
  exercise_adjustments: z
    .array(
      z.object({
        exercise: z.string(),
        action: z.enum(["keep", "modify", "replace", "remove", "add"]),
        change: z.string(),
        reason: z.string(),
      }),
    )
    .describe("How the user's CURRENT exercises should change to reach the goal. Empty if they have none."),
  milestones: z.array(z.object({ week: z.number().int(), target: z.string() })),
});
export type BodyPlan = z.infer<typeof planSchema>;

export type PlanReport = {
  id: string;
  created_at: string;
  body_scan_id: string | null;
  goal_id: string | null;
  content: BodyPlan;
};

export const generatePlanInput = z.object({
  scan_id: z.uuid().optional(),
  notes: z.string().trim().max(1000).optional().describe("Extra context: injuries, diet preference, schedule"),
});

export const applyPlanInput = z.object({
  nutrition: z.boolean().default(true),
  training: z.boolean().default(false),
});

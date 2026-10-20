import { z } from "zod";

export const exerciseCategory = z.enum(["strength", "cardio", "mobility", "plyometric"]);

export const exerciseSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid().nullable(),
  name: z.string(),
  muscle_group: z.string(),
  secondary_muscles: z.array(z.string()),
  equipment: z.string().nullable(),
  category: exerciseCategory,
  instructions: z.string().nullable(),
  source_url: z.string().nullable(),
  created_at: z.string(),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const exerciseSearchQuery = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

export const createExerciseInput = z.object({
  name: z.string().trim().min(2).max(80),
  muscle_group: z.string().trim().min(2).max(40).toLowerCase(),
  secondary_muscles: z.array(z.string().trim().toLowerCase()).max(8).default([]),
  equipment: z.string().trim().max(40).nullish(),
  category: exerciseCategory.default("strength"),
  instructions: z.string().trim().max(2000).nullish(),
  source_url: z.url().nullish(),
});
export type CreateExerciseInput = z.infer<typeof createExerciseInput>;

export const exerciseLookupInput = z.object({
  /** Free text, typed or transcribed from speech, e.g. "incline smith press 3x10 at 60". */
  query: z.string().trim().min(2).max(300),
});

/** Shape Claude must answer with when resolving a typed/spoken exercise. */
export const exerciseLookupResult = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string().describe("Canonical, commonly used exercise name in Title Case"),
        muscle_group: z
          .string()
          .describe(
            "Primary muscle, one of: chest, back, shoulders, traps, biceps, triceps, forearms, quads, hamstrings, glutes, calves, core, cardio, full body",
          ),
        secondary_muscles: z.array(z.string()),
        equipment: z.string().describe("barbell, dumbbell, cable, machine, smith machine, bodyweight, kettlebell, band, other"),
        category: exerciseCategory,
        instructions: z.string().describe("3-5 short form cues"),
        source_url: z.string().nullable().describe("A reputable page describing the exercise, if one was found"),
      }),
    )
    .describe("Best matches first, at most 4"),
  detected_sets: z
    .array(z.object({ weight_kg: z.number(), reps: z.number().int() }))
    .describe("Sets mentioned in the text (convert lb to kg). Empty if none mentioned."),
});
export type ExerciseLookupResult = z.infer<typeof exerciseLookupResult>;

import { z } from "zod";
import type { Exercise } from "@/modules/exercises/schemas";

export const weekday = z.coerce.number().int().min(1).max(7);
export const isoDate = z.iso.date();

export const WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
] as const;

// ---- Set logs -------------------------------------------------------------
export const setLogSchema = z.object({
  id: z.uuid(),
  exercise_id: z.uuid(),
  performed_on: isoDate,
  set_number: z.number(),
  weight_kg: z.coerce.number(),
  reps: z.number(),
  rpe: z.coerce.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SetLog = z.infer<typeof setLogSchema>;

export const createSetInput = z.object({
  exercise_id: z.uuid(),
  performed_on: isoDate.optional(),
  set_number: z.number().int().min(1).max(50).optional(),
  weight_kg: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(500),
  rpe: z.number().min(1).max(10).nullish(),
  notes: z.string().trim().max(300).nullish(),
});
export type CreateSetInput = z.infer<typeof createSetInput>;
export const createSetsInput = z.object({ sets: z.array(createSetInput).min(1).max(30) });
export const updateSetInput = createSetInput.omit({ exercise_id: true }).partial();
export type UpdateSetInput = z.infer<typeof updateSetInput>;

// ---- Routine --------------------------------------------------------------
export const createRoutineInput = z.object({
  weekday,
  exercise_id: z.uuid(),
  target_sets: z.number().int().min(1).max(20).nullish(),
  target_reps: z.string().trim().max(20).nullish(),
  notes: z.string().trim().max(300).nullish(),
});
export type CreateRoutineInput = z.infer<typeof createRoutineInput>;
export const updateRoutineInput = createRoutineInput
  .omit({ exercise_id: true })
  .partial()
  .extend({ position: z.number().int().min(0).optional() });
export type UpdateRoutineInput = z.infer<typeof updateRoutineInput>;

export const routineQuery = z.object({ weekday, date: isoDate.optional() });

// ---- Read models ----------------------------------------------------------
export type ExerciseStats = {
  /** Most recent session before the viewed day. */
  lastSession: { date: string; sets: SetLog[] } | null;
  /** When any set of this exercise was last added or edited. */
  lastUpdatedAt: string | null;
  best: { weight_kg: number; reps: number; date: string } | null;
  estimatedOneRepMax: number | null;
};

export type RoutineItem = {
  id: string;
  weekday: number;
  position: number;
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  exercise: Exercise;
  /** Sets logged on the requested date. */
  todaySets: SetLog[];
  stats: ExerciseStats;
  /** "When did I last hit this weight" lookup, heaviest first. */
  byWeight: WeightRecord[];
};

export type WeightRecord = { weight_kg: number; bestReps: number; lastDate: string; lastUpdatedAt: string };

export type ExerciseHistory = {
  exercise: Exercise;
  stats: ExerciseStats;
  sessions: { date: string; sets: SetLog[]; volume: number }[];
  /** "When did I last hit this weight" lookup, heaviest first. */
  byWeight: WeightRecord[];
};

import "server-only";
import { generateStructured } from "@/lib/ai";
import { unwrap } from "@/lib/api/handler";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  exerciseLookupResult,
  type CreateExerciseInput,
  type Exercise,
  type ExerciseLookupResult,
} from "./schemas";

export async function searchExercises(db: SupabaseServerClient, q: string, limit: number): Promise<Exercise[]> {
  let query = db.from("exercises").select("*").order("name").limit(limit);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  return unwrap(await query);
}

/** Creates a user exercise, or returns the existing one with the same name (global or own). */
export async function upsertExercise(
  db: SupabaseServerClient,
  userId: string,
  input: CreateExerciseInput,
): Promise<Exercise> {
  const existing = unwrap(await db.from("exercises").select("*").ilike("name", input.name).limit(1));
  if (existing.length) return existing[0];

  return unwrap(
    await db
      .from("exercises")
      .insert({ ...input, user_id: userId })
      .select("*")
      .single(),
  );
}

const LOOKUP_SYSTEM = `You identify gym exercises from short, possibly messy text that a lifter typed or dictated by voice.
Speech transcription may garble names ("rdl", "skull crushers", "lap pull down" = lat pulldown).
Return the most likely exercise(s) using their standard names. If the name is unusual or you are unsure it exists,
search the web to confirm it and cite a reputable source. Also extract any sets mentioned (weight and reps).`;

export async function lookupExerciseWithAi(query: string): Promise<ExerciseLookupResult> {
  return generateStructured({
    schema: exerciseLookupResult,
    name: "exercise_lookup",
    system: LOOKUP_SYSTEM,
    content: query,
    webSearch: true,
    effort: "low",
  });
}

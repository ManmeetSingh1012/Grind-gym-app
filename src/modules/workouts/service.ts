import "server-only";
import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/handler";
import { daysAgoIso, toIsoDate } from "@/lib/dates";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { exerciseSchema } from "@/modules/exercises/schemas";
import {
  setLogSchema,
  type CreateRoutineInput,
  type CreateSetInput,
  type ExerciseHistory,
  type RoutineItem,
  type SetLog,
  type UpdateRoutineInput,
  type UpdateSetInput,
} from "./schemas";
import { computeStats, groupByDate, recordsByWeight } from "./stats";

const SET_COLUMNS = "id, exercise_id, performed_on, set_number, weight_kg, reps, rpe, notes, created_at, updated_at";
const parseSets = (rows: unknown) => z.array(setLogSchema).parse(rows);

async function setsFor(db: SupabaseServerClient, exerciseIds: string[], limit = 2000): Promise<SetLog[]> {
  if (!exerciseIds.length) return [];
  const rows = unwrap(
    await db
      .from("set_logs")
      .select(SET_COLUMNS)
      .in("exercise_id", exerciseIds)
      .order("performed_on", { ascending: false })
      .order("set_number", { ascending: true })
      .limit(limit),
  );
  return parseSets(rows);
}

// ---- Routine --------------------------------------------------------------

export async function listRoutine(db: SupabaseServerClient, weekday: number, date = toIsoDate()): Promise<RoutineItem[]> {
  const rows = unwrap(
    await db
      .from("routine_exercises")
      .select("id, weekday, position, target_sets, target_reps, notes, exercise:exercises(*)")
      .eq("weekday", weekday)
      .order("position")
      .order("created_at"),
  );

  const items = rows.map((r) => ({ ...r, exercise: exerciseSchema.parse(r.exercise) }));
  const sets = await setsFor(
    db,
    items.map((r) => r.exercise.id),
  );

  return items.map((r) => {
    const mine = sets.filter((s) => s.exercise_id === r.exercise.id);
    return {
      id: r.id,
      weekday: r.weekday,
      position: r.position,
      target_sets: r.target_sets,
      target_reps: r.target_reps,
      notes: r.notes,
      exercise: r.exercise,
      todaySets: mine.filter((s) => s.performed_on === date),
      stats: computeStats(mine, date),
      byWeight: recordsByWeight(mine),
    };
  });
}

export async function addToRoutine(db: SupabaseServerClient, input: CreateRoutineInput) {
  const { count } = await db
    .from("routine_exercises")
    .select("id", { count: "exact", head: true })
    .eq("weekday", input.weekday);
  return unwrap(
    await db
      .from("routine_exercises")
      .insert({ ...input, position: count ?? 0 })
      .select("id")
      .single(),
  );
}

export async function updateRoutine(db: SupabaseServerClient, id: string, input: UpdateRoutineInput) {
  const row = unwrap(await db.from("routine_exercises").update(input).eq("id", id).select("id").maybeSingle());
  if (!row) throw notFound("Routine exercise");
  return row;
}

export async function removeFromRoutine(db: SupabaseServerClient, id: string) {
  unwrap(await db.from("routine_exercises").delete().eq("id", id));
}

// ---- Sets -----------------------------------------------------------------

export async function logSets(db: SupabaseServerClient, inputs: CreateSetInput[]): Promise<SetLog[]> {
  const date = inputs[0].performed_on ?? toIsoDate();
  // Continue numbering after the sets already logged for that exercise on that day.
  const existing = parseSets(
    unwrap(
      await db
        .from("set_logs")
        .select(SET_COLUMNS)
        .in("exercise_id", [...new Set(inputs.map((i) => i.exercise_id))])
        .eq("performed_on", date),
    ),
  );
  const next = new Map<string, number>();
  for (const s of existing) next.set(s.exercise_id, Math.max(next.get(s.exercise_id) ?? 0, s.set_number));

  const rows = inputs.map((i) => {
    const n = i.set_number ?? (next.get(i.exercise_id) ?? 0) + 1;
    next.set(i.exercise_id, n);
    return { ...i, performed_on: i.performed_on ?? date, set_number: n };
  });
  return parseSets(unwrap(await db.from("set_logs").insert(rows).select(SET_COLUMNS)));
}

export async function updateSet(db: SupabaseServerClient, id: string, input: UpdateSetInput) {
  const row = unwrap(await db.from("set_logs").update(input).eq("id", id).select(SET_COLUMNS).maybeSingle());
  if (!row) throw notFound("Set");
  return setLogSchema.parse(row);
}

export async function deleteSet(db: SupabaseServerClient, id: string) {
  unwrap(await db.from("set_logs").delete().eq("id", id));
}

// ---- History --------------------------------------------------------------

export async function exerciseHistory(db: SupabaseServerClient, exerciseId: string): Promise<ExerciseHistory> {
  const row = unwrap(await db.from("exercises").select("*").eq("id", exerciseId).maybeSingle());
  if (!row) throw notFound("Exercise");
  const sets = await setsFor(db, [exerciseId]);
  return {
    exercise: exerciseSchema.parse(row),
    stats: computeStats(sets),
    sessions: groupByDate(sets),
    byWeight: recordsByWeight(sets),
  };
}

/** Routine plus recent sets, condensed to compact text-friendly JSON for AI prompts. */
export async function recentTrainingSummary(db: SupabaseServerClient, days = 56) {
  const [routine, sets] = await Promise.all([
    db.from("routine_exercises").select("weekday, target_sets, target_reps, exercise:exercises(name, muscle_group)"),
    db
      .from("set_logs")
      .select("performed_on, weight_kg, reps, rpe, exercise:exercises(name)")
      .gte("performed_on", daysAgoIso(days))
      .order("performed_on", { ascending: true })
      .order("set_number", { ascending: true }),
  ]);

  type SetRow = { performed_on: string; weight_kg: number; reps: number; rpe: number | null; exercise: { name: string } };
  const history: Record<string, { date: string; sets: string }[]> = {};
  for (const s of unwrap(sets) as unknown as SetRow[]) {
    const list = (history[s.exercise.name] ??= []);
    const entry = `${Number(s.weight_kg)}kg x${s.reps}${s.rpe ? ` @${s.rpe}` : ""}`;
    const last = list.at(-1);
    if (last?.date === s.performed_on) last.sets += `, ${entry}`;
    else list.push({ date: s.performed_on, sets: entry });
  }

  type RoutineRow = { weekday: number; target_sets: number | null; target_reps: string | null; exercise: { name: string; muscle_group: string } };
  return {
    routine: (unwrap(routine) as unknown as RoutineRow[]).map((r) => ({
      weekday: r.weekday,
      exercise: r.exercise.name,
      muscle: r.exercise.muscle_group,
      target: `${r.target_sets ?? "?"} x ${r.target_reps ?? "?"}`,
    })),
    history,
  };
}

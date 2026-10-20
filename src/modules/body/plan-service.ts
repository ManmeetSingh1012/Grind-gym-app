import "server-only";
import { aiModel, generateStructured } from "@/lib/ai";
import { badRequest, notFound } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/handler";
import { ageFrom } from "@/lib/dates";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { searchExercises, upsertExercise } from "@/modules/exercises/service";
import { activeGoal } from "@/modules/goals/service";
import { saveTargets } from "@/modules/nutrition/service";
import { microTargets } from "@/modules/nutrition/targets";
import { getProfile } from "@/modules/profile/service";
import { recentTrainingSummary } from "@/modules/workouts/service";
import { planSchema, type PlanReport } from "./schemas";
import { getScan, latestScan } from "./service";

const PLAN_SYSTEM = `You are an evidence-based strength coach and sports dietitian.
Build a complete, realistic plan from the user's body composition, goal and current training.
- Nutrition: set calories/macros for the goal (use measured BMR when given), sample one day of meals that hit the
  numbers, and call out micronutrients that matter most for this person.
- Training: a weekly split honoring the requested number of training days (default Monday-Saturday) with sets, reps
  and rest. Prefer keeping the user's existing exercises where they fit; that continuity matters.
  When an exercise exists in exercise_library, use that exact name so logged history stays together.
- Cardio: weekly sessions plus a daily step target.
- exercise_adjustments: go through EVERY exercise the user currently does and say whether to keep, modify (sets,
  reps, load, tempo, frequency), replace or remove it, and what to add - always with the reason tied to their goal
  and their logged performance (stalls, imbalances, recovery).
- Milestones: what they should see at weeks 2, 4, 8 and 12.
Be specific and practical. No medical diagnoses.`;

export async function generatePlan(
  db: SupabaseServerClient,
  userId: string,
  opts: { scanId?: string; notes?: string },
): Promise<PlanReport> {
  const [profile, goal, scan, training, library] = await Promise.all([
    getProfile(db, userId),
    activeGoal(db),
    opts.scanId ? getScan(db, opts.scanId) : latestScan(db),
    recentTrainingSummary(db),
    searchExercises(db, "", 500),
  ]);
  if (!scan && !profile.weight_kg) {
    throw badRequest("Upload a body composition scan or add your weight in Profile first.");
  }

  const context = {
    profile: {
      sex: profile.sex,
      age: ageFrom(profile.birth_date),
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      activity_level: profile.activity_level,
    },
    goal: goal
      ? {
          type: goal.type,
          title: goal.title,
          target_weight_kg: goal.target_weight_kg,
          target_body_fat_pct: goal.target_body_fat_pct,
          target_date: goal.target_date,
          training_days_per_week: goal.training_days,
          notes: goal.notes,
        }
      : "No goal set - assume a body recomposition goal, 6 training days.",
    body_composition: scan
      ? {
          date: scan.scanned_on,
          weight_kg: scan.weight_kg,
          body_fat_pct: scan.body_fat_pct,
          skeletal_muscle_kg: scan.skeletal_muscle_kg,
          fat_mass_kg: scan.fat_mass_kg,
          visceral_fat_level: scan.visceral_fat_level,
          bmr_kcal: scan.bmr_kcal,
          total_body_water_l: scan.total_body_water_l,
          other: scan.metrics.other ?? [],
        }
      : null,
    current_routine: training.routine,
    exercise_library: library.map((e) => e.name),
    last_8_weeks_sets: training.history,
    user_notes: opts.notes ?? null,
  };

  const content = await generateStructured({
    schema: planSchema,
    name: "body_plan",
    system: PLAN_SYSTEM,
    content: `Here is my data as JSON. Create my plan.\n\n${JSON.stringify(context)}`,
    effort: "high",
    maxTokens: 32000,
  });

  const row = unwrap(
    await db
      .from("ai_reports")
      .insert({ kind: "body_plan", body_scan_id: scan?.id ?? null, goal_id: goal?.id ?? null, content, model: aiModel() })
      .select("id, created_at, body_scan_id, goal_id, content")
      .single(),
  );
  return row as unknown as PlanReport;
}

export async function latestPlan(db: SupabaseServerClient): Promise<PlanReport | null> {
  const row = unwrap(
    await db
      .from("ai_reports")
      .select("id, created_at, body_scan_id, goal_id, content")
      .eq("kind", "body_plan")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  return (row as unknown as PlanReport | null) ?? null;
}

/** Copies the plan's nutrition targets and/or weekly split into the user's live data. */
export async function applyPlan(
  db: SupabaseServerClient,
  userId: string,
  planId: string,
  opts: { nutrition: boolean; training: boolean },
) {
  const row = unwrap(
    await db.from("ai_reports").select("content").eq("id", planId).eq("kind", "body_plan").maybeSingle(),
  ) as { content: unknown } | null;
  if (!row) throw notFound("Plan");
  const plan = planSchema.parse(row.content);

  if (opts.nutrition) {
    const profile = await getProfile(db, userId);
    const n = plan.nutrition;
    await saveTargets(
      db,
      userId,
      {
        calories: n.calories,
        protein_g: n.protein_g,
        carbs_g: n.carbs_g,
        fat_g: n.fat_g,
        micros: microTargets(profile.sex === "female", n.calories),
      },
      "ai_plan",
    );
  }

  if (opts.training) {
    for (const day of plan.training.days) {
      if (day.weekday < 1 || day.weekday > 7) continue;
      unwrap(await db.from("routine_exercises").delete().eq("weekday", day.weekday));
      const rows: { weekday: number; exercise_id: string; position: number; target_sets: number; target_reps: string; notes: string | null }[] = [];
      for (const [position, ex] of day.exercises.entries()) {
        const exercise = await upsertExercise(db, userId, {
          name: ex.name,
          muscle_group: ex.muscle_group.toLowerCase(),
          secondary_muscles: [],
          category: ex.category,
        });
        rows.push({
          weekday: day.weekday,
          exercise_id: exercise.id,
          position,
          target_sets: ex.sets,
          target_reps: ex.reps,
          notes: ex.notes || null,
        });
      }
      // A plan can list the same exercise twice in a day; keep the first.
      const unique = rows.filter((r, i) => rows.findIndex((o) => o.exercise_id === r.exercise_id) === i);
      if (unique.length) unwrap(await db.from("routine_exercises").insert(unique));
    }
  }

  return { applied: opts };
}

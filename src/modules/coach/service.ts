import "server-only";
import { aiModel, generateStructured } from "@/lib/ai";
import { badRequest } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/handler";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { activeGoal } from "@/modules/goals/service";
import { recentTrainingSummary } from "@/modules/workouts/service";
import { workoutInsightsSchema, type InsightsReport } from "./schemas";

const INSIGHTS_SYSTEM = `You are an AI strength coach reviewing a lifter's log (weights in kg, weekday 1=Monday).
Analyse every exercise: is load or reps progressing, stalled, or dropping? Give a concrete next-session target
using sensible progressive overload (small load jumps for upper body, larger for lower body; add reps before load).
Count weekly hard sets per muscle (10-20 is a typical hypertrophy range) and flag imbalances. Tie advice to the goal.`;

export async function generateInsights(db: SupabaseServerClient): Promise<InsightsReport> {
  const [training, goal] = await Promise.all([recentTrainingSummary(db), activeGoal(db)]);
  if (!Object.keys(training.history).length) {
    throw badRequest("Log a few workouts first so the coach has something to analyse.");
  }

  const content = await generateStructured({
    schema: workoutInsightsSchema,
    name: "workout_insights",
    system: INSIGHTS_SYSTEM,
    content: JSON.stringify({ goal: goal ?? "general fitness", ...training }),
    effort: "medium",
  });

  const row = unwrap(
    await db
      .from("ai_reports")
      .insert({ kind: "workout_insights", content, model: aiModel(), goal_id: goal?.id ?? null })
      .select("id, created_at, content")
      .single(),
  );
  return row as unknown as InsightsReport;
}

export async function latestInsights(db: SupabaseServerClient): Promise<InsightsReport | null> {
  const row = unwrap(
    await db
      .from("ai_reports")
      .select("id, created_at, content")
      .eq("kind", "workout_insights")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  return (row as unknown as InsightsReport | null) ?? null;
}

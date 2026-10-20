import { z } from "zod";

export const workoutInsightsSchema = z.object({
  headline: z.string().describe("One punchy sentence on how training is going"),
  consistency: z.string().describe("Sessions per week vs plan, missed days"),
  exercises: z.array(
    z.object({
      exercise: z.string(),
      trend: z.enum(["improving", "stalled", "declining", "new"]),
      last_best: z.string().describe("e.g. '80kg x 8'"),
      next_target: z.string().describe("Concrete next-session target, e.g. '82.5kg x 6-8' or '80kg x 9'"),
      advice: z.string(),
    }),
  ),
  muscle_balance: z.array(
    z.object({
      muscle: z.string(),
      weekly_sets: z.number(),
      status: z.enum(["low", "ok", "high"]),
    }),
  ),
  warnings: z.array(z.string()).describe("Overtraining, imbalances, missing muscle groups, stalls > 3 weeks"),
  next_session_focus: z.string(),
});
export type WorkoutInsights = z.infer<typeof workoutInsightsSchema>;

export type InsightsReport = { id: string; created_at: string; content: WorkoutInsights };

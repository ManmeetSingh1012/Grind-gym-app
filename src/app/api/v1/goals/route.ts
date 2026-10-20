import { apiRoute } from "@/lib/api/handler";
import { createGoalInput } from "@/modules/goals/schemas";
import { createGoal, listGoals } from "@/modules/goals/service";

export const GET = apiRoute({}, ({ supabase }) => listGoals(supabase));

export const POST = apiRoute({ body: createGoalInput, status: 201 }, ({ supabase, body }) =>
  createGoal(supabase, body),
);

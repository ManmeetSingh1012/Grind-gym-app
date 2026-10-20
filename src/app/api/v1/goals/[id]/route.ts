import { apiRoute } from "@/lib/api/handler";
import { updateGoalInput } from "@/modules/goals/schemas";
import { deleteGoal, updateGoal } from "@/modules/goals/service";

export const PATCH = apiRoute({ body: updateGoalInput }, ({ supabase, params, body }) =>
  updateGoal(supabase, params.id, body),
);

export const DELETE = apiRoute({}, ({ supabase, params }) => deleteGoal(supabase, params.id));

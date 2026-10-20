import { apiRoute } from "@/lib/api/handler";
import { updateRoutineInput } from "@/modules/workouts/schemas";
import { removeFromRoutine, updateRoutine } from "@/modules/workouts/service";

export const PATCH = apiRoute({ body: updateRoutineInput }, ({ supabase, params, body }) =>
  updateRoutine(supabase, params.id, body),
);

export const DELETE = apiRoute({}, ({ supabase, params }) => removeFromRoutine(supabase, params.id));

import { apiRoute } from "@/lib/api/handler";
import { updateSetInput } from "@/modules/workouts/schemas";
import { deleteSet, updateSet } from "@/modules/workouts/service";

export const PATCH = apiRoute({ body: updateSetInput }, ({ supabase, params, body }) =>
  updateSet(supabase, params.id, body),
);

export const DELETE = apiRoute({}, ({ supabase, params }) => deleteSet(supabase, params.id));

import { apiRoute } from "@/lib/api/handler";
import { updateTargetsInput } from "@/modules/nutrition/schemas";
import { getTargets, resetTargets, saveTargets } from "@/modules/nutrition/service";

export const GET = apiRoute({}, ({ supabase, userId }) => getTargets(supabase, userId));

export const PUT = apiRoute({ body: updateTargetsInput }, ({ supabase, userId, body }) =>
  saveTargets(supabase, userId, body, "manual"),
);

/** Drops custom targets and goes back to the calculated ones. */
export const DELETE = apiRoute({}, ({ supabase, userId }) => resetTargets(supabase, userId));

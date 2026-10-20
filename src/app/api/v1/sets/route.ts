import { apiRoute } from "@/lib/api/handler";
import { createSetsInput } from "@/modules/workouts/schemas";
import { logSets } from "@/modules/workouts/service";

export const POST = apiRoute({ body: createSetsInput, status: 201 }, ({ supabase, body }) =>
  logSets(supabase, body.sets),
);

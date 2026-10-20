import { apiRoute } from "@/lib/api/handler";
import { calculateTargetsInput } from "@/modules/nutrition/schemas";
import { calculateAndMaybeSave } from "@/modules/nutrition/service";

/** Preview daily targets for a goal + pace (`save: false`), or save them (`save: true`). */
export const POST = apiRoute({ body: calculateTargetsInput }, ({ supabase, userId, body }) =>
  calculateAndMaybeSave(supabase, userId, body),
);

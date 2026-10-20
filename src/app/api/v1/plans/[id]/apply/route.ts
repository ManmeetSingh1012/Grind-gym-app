import { apiRoute } from "@/lib/api/handler";
import { applyPlanInput } from "@/modules/body/schemas";
import { applyPlan } from "@/modules/body/plan-service";

export const POST = apiRoute({ body: applyPlanInput }, ({ supabase, userId, params, body }) =>
  applyPlan(supabase, userId, params.id, body),
);

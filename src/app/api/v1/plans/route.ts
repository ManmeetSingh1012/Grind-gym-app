import { apiRoute } from "@/lib/api/handler";
import { generatePlanInput } from "@/modules/body/schemas";
import { generatePlan, latestPlan } from "@/modules/body/plan-service";

// Full plan generation runs at high effort and can take a while.
export const maxDuration = 300;

export const GET = apiRoute({}, ({ supabase }) => latestPlan(supabase));

export const POST = apiRoute({ body: generatePlanInput, status: 201 }, ({ supabase, userId, body }) =>
  generatePlan(supabase, userId, { scanId: body.scan_id, notes: body.notes }),
);

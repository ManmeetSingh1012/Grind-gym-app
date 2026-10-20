import { apiRoute } from "@/lib/api/handler";
import { generateInsights, latestInsights } from "@/modules/coach/service";

export const maxDuration = 120;

export const GET = apiRoute({}, ({ supabase }) => latestInsights(supabase));

export const POST = apiRoute({ status: 201 }, ({ supabase }) => generateInsights(supabase));

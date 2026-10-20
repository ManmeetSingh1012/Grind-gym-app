import { apiRoute } from "@/lib/api/handler";
import { toIsoDate } from "@/lib/dates";
import { dateQuery } from "@/modules/nutrition/schemas";
import { daySummary } from "@/modules/nutrition/service";

export const GET = apiRoute({ query: dateQuery }, ({ supabase, userId, query }) =>
  daySummary(supabase, userId, query.date ?? toIsoDate()),
);

import { apiRoute } from "@/lib/api/handler";
import { toIsoDate } from "@/lib/dates";
import { createFoodLogsInput, dateQuery } from "@/modules/nutrition/schemas";
import { createFoodLogs, listFoodLogs } from "@/modules/nutrition/service";

export const GET = apiRoute({ query: dateQuery }, ({ supabase, query }) =>
  listFoodLogs(supabase, query.date ?? toIsoDate()),
);

export const POST = apiRoute({ body: createFoodLogsInput, status: 201 }, ({ supabase, body }) =>
  createFoodLogs(supabase, body.items),
);

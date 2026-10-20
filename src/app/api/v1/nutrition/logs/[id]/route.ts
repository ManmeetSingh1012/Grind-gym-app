import { apiRoute } from "@/lib/api/handler";
import { updateFoodLogInput } from "@/modules/nutrition/schemas";
import { deleteFoodLog, updateFoodLog } from "@/modules/nutrition/service";

export const PATCH = apiRoute({ body: updateFoodLogInput }, ({ supabase, params, body }) =>
  updateFoodLog(supabase, params.id, body),
);

export const DELETE = apiRoute({}, ({ supabase, params }) => deleteFoodLog(supabase, params.id));

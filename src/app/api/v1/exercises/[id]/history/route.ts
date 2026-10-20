import { apiRoute } from "@/lib/api/handler";
import { exerciseHistory } from "@/modules/workouts/service";

export const GET = apiRoute({}, ({ supabase, params }) => exerciseHistory(supabase, params.id));

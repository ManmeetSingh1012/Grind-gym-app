import { apiRoute } from "@/lib/api/handler";
import { createRoutineInput, routineQuery } from "@/modules/workouts/schemas";
import { addToRoutine, listRoutine } from "@/modules/workouts/service";

export const GET = apiRoute({ query: routineQuery }, ({ supabase, query }) =>
  listRoutine(supabase, query.weekday, query.date),
);

export const POST = apiRoute({ body: createRoutineInput, status: 201 }, ({ supabase, body }) =>
  addToRoutine(supabase, body),
);

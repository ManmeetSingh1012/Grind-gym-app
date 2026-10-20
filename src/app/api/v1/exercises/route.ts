import { apiRoute } from "@/lib/api/handler";
import { createExerciseInput, exerciseSearchQuery } from "@/modules/exercises/schemas";
import { searchExercises, upsertExercise } from "@/modules/exercises/service";

export const GET = apiRoute({ query: exerciseSearchQuery }, ({ supabase, query }) =>
  searchExercises(supabase, query.q, query.limit),
);

export const POST = apiRoute({ body: createExerciseInput, status: 201 }, ({ supabase, userId, body }) =>
  upsertExercise(supabase, userId, body),
);

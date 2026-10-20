import { apiRoute } from "@/lib/api/handler";
import { exerciseLookupInput } from "@/modules/exercises/schemas";
import { lookupExerciseWithAi } from "@/modules/exercises/service";

export const maxDuration = 60;

/** Resolves typed or spoken text to exercises, searching the web when needed. */
export const POST = apiRoute({ body: exerciseLookupInput }, ({ body }) => lookupExerciseWithAi(body.query));

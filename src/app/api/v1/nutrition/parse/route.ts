import { apiRoute } from "@/lib/api/handler";
import { parseMealInput } from "@/modules/nutrition/schemas";
import { parseMealWithAi } from "@/modules/nutrition/service";

export const maxDuration = 60;

/** "2 rotis, dal and a bowl of curd" -> itemised foods with macros and micros. */
export const POST = apiRoute({ body: parseMealInput }, ({ body }) => parseMealWithAi(body.text));

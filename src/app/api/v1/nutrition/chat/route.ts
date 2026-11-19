import { apiRoute } from "@/lib/api/handler";
import { dietChatInput } from "@/modules/diet-chat/schemas";
import { dietChat } from "@/modules/diet-chat/service";

export const maxDuration = 60;

/** Diet-only AI coach chat. Answers with a reply plus any foods the user said they ate (ready to log). */
export const POST = apiRoute({ body: dietChatInput }, ({ supabase, userId, body }) => dietChat(supabase, userId, body));

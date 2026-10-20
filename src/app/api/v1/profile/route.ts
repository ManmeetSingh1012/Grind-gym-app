import { apiRoute } from "@/lib/api/handler";
import { updateProfileInput } from "@/modules/profile/schemas";
import { getProfile, updateProfile } from "@/modules/profile/service";

export const GET = apiRoute({}, ({ supabase, userId }) => getProfile(supabase, userId));

export const PATCH = apiRoute({ body: updateProfileInput }, ({ supabase, userId, body }) =>
  updateProfile(supabase, userId, body),
);

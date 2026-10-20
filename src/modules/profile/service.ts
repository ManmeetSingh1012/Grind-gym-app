import "server-only";
import { unwrap } from "@/lib/api/handler";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { profileSchema, type Profile, type UpdateProfileInput } from "./schemas";

const COLUMNS = "id, display_name, sex, birth_date, height_cm, weight_kg, activity_level";

export async function getProfile(db: SupabaseServerClient, userId: string): Promise<Profile> {
  const row = unwrap(await db.from("profiles").select(COLUMNS).eq("id", userId).maybeSingle());
  // The signup trigger normally creates this row; self-heal if it is missing.
  if (!row) {
    return profileSchema.parse(unwrap(await db.from("profiles").insert({ id: userId }).select(COLUMNS).single()));
  }
  return profileSchema.parse(row);
}

export async function updateProfile(db: SupabaseServerClient, userId: string, input: UpdateProfileInput) {
  return profileSchema.parse(
    unwrap(await db.from("profiles").update(input).eq("id", userId).select(COLUMNS).single()),
  );
}

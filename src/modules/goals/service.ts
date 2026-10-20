import "server-only";
import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/handler";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { goalSchema, type CreateGoalInput, type Goal, type UpdateGoalInput } from "./schemas";

export async function listGoals(db: SupabaseServerClient): Promise<Goal[]> {
  const rows = unwrap(
    await db.from("goals").select("*").order("is_active", { ascending: false }).order("created_at", { ascending: false }),
  );
  return z.array(goalSchema).parse(rows);
}

export async function activeGoal(db: SupabaseServerClient): Promise<Goal | null> {
  const row = unwrap(await db.from("goals").select("*").eq("is_active", true).maybeSingle());
  return row ? goalSchema.parse(row) : null;
}

/** Only one goal can be active; activating one archives the rest. */
async function deactivateOthers(db: SupabaseServerClient, exceptId?: string) {
  let q = db.from("goals").update({ is_active: false }).eq("is_active", true);
  if (exceptId) q = q.neq("id", exceptId);
  unwrap(await q);
}

export async function createGoal(db: SupabaseServerClient, input: CreateGoalInput): Promise<Goal> {
  if (input.is_active) await deactivateOthers(db);
  return goalSchema.parse(unwrap(await db.from("goals").insert(input).select("*").single()));
}

export async function updateGoal(db: SupabaseServerClient, id: string, input: UpdateGoalInput): Promise<Goal> {
  if (input.is_active) await deactivateOthers(db, id);
  const row = unwrap(await db.from("goals").update(input).eq("id", id).select("*").maybeSingle());
  if (!row) throw notFound("Goal");
  return goalSchema.parse(row);
}

export async function deleteGoal(db: SupabaseServerClient, id: string) {
  unwrap(await db.from("goals").delete().eq("id", id));
}

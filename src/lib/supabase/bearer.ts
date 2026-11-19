import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { SupabaseServerClient } from "./server";

/** Reads `Authorization: Bearer <supabase access token>`; null when absent. */
export function bearerToken(headers: Headers): string | null {
  const value = headers.get("authorization");
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Supabase client acting as the user who owns `token` (RLS applies as usual).
 * Used by external callers such as the MCP bridge, which have no browser cookies.
 */
export function createBearerClient(token: string): SupabaseServerClient {
  const env = serverEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) as unknown as SupabaseServerClient;
}

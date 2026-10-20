import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { ApiError } from "./errors";

export interface RouteContext<TBody, TQuery> {
  req: NextRequest;
  body: TBody;
  query: TQuery;
  params: Record<string, string>;
  supabase: SupabaseServerClient;
  userId: string;
}

interface RouteOptions<TBody, TQuery> {
  body?: z.ZodType<TBody>;
  query?: z.ZodType<TQuery>;
  /** Status for a successful response (default 200). */
  status?: number;
}

/**
 * Wraps a route handler with auth, zod validation of body/query, and a uniform
 * `{ data } | { error }` envelope. Every /api/v1 route goes through this.
 */
export function apiRoute<TBody = undefined, TQuery = undefined>(
  options: RouteOptions<TBody, TQuery>,
  fn: (ctx: RouteContext<TBody, TQuery>) => Promise<unknown>,
) {
  return async (req: NextRequest, routeCtx: { params: Promise<Record<string, string>> }) => {
    try {
      const supabase = await createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims.sub;
      if (!userId) throw new ApiError(401, "unauthorized", "Sign in required");

      const query = options.query
        ? parseOrThrow(options.query, Object.fromEntries(req.nextUrl.searchParams), "query")
        : (undefined as TQuery);

      let body = undefined as TBody;
      if (options.body) {
        const json = await req.json().catch(() => {
          throw new ApiError(400, "bad_request", "Body must be valid JSON");
        });
        body = parseOrThrow(options.body, json, "body");
      }

      const params = (await routeCtx?.params) ?? {};
      const data = await fn({ req, body, query, params, supabase, userId });
      return NextResponse.json({ data: data ?? null }, { status: options.status ?? 200 });
    } catch (err) {
      // Let Next.js internals (e.g. the prerender bail-out from cookies()) propagate.
      unstable_rethrow(err);
      return toErrorResponse(err);
    }
  };
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, where: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, "bad_request", `Invalid ${where}`, z.flattenError(result.error));
  }
  return result.data as T;
}

function toErrorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  // Supabase/PostgREST errors carry a `code`; unique violations map to 409.
  if (isPostgrestError(err)) {
    const status = err.code === "23505" ? 409 : err.code === "PGRST116" ? 404 : 400;
    const code = status === 409 ? "conflict" : status === 404 ? "not_found" : "bad_request";
    return NextResponse.json({ error: { code, message: err.message } }, { status });
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
}

function isPostgrestError(err: unknown): err is { code: string; message: string } {
  return typeof err === "object" && err !== null && "code" in err && "message" in err && "details" in err;
}

/** Unwraps a supabase-js result, throwing the PostgREST error if present. For maybeSingle(), null-check the result. */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

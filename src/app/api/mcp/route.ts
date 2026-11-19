import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { authenticate } from "@/lib/api/handler";
import { TOOLS, toolList, type ToolContext } from "@/modules/mcp/tools";

export const maxDuration = 60;

/**
 * Model Context Protocol endpoint (Streamable HTTP, stateless, JSON responses).
 * Auth: `Authorization: Bearer <Supabase access token>`. The stdio bridge in `mcp/grind-mcp.mjs`
 * signs in, keeps the token fresh and forwards here, so any MCP client can connect.
 */
const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "grind", title: "Grind gym tracker", version: "1.0.0" };
const INSTRUCTIONS = `Grind is the user's gym, food and body tracker. Weights are kg, dates YYYY-MM-DD, weekday 1=Monday.
Typical flows: get_nutrition_day -> log_meal / update_food_log; get_workout_day -> log_sets with an exercise id.`;

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });

async function handle(msg: RpcRequest, getCtx: () => Promise<ToolContext>) {
  switch (msg.method) {
    case "initialize": {
      const requested = String(msg.params?.protocolVersion ?? "");
      return rpcResult(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: toolList() });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${name}`);
      const args = tool.input.safeParse(msg.params?.arguments ?? {});
      if (!args.success) {
        return rpcResult(msg.id, { isError: true, content: [{ type: "text", text: `Invalid arguments: ${z.prettifyError(args.error)}` }] });
      }
      try {
        const data = await tool.run(await getCtx(), args.data);
        const structured = data !== null && typeof data === "object" && !Array.isArray(data) ? data : { result: data ?? null };
        return rpcResult(msg.id, {
          content: [{ type: "text", text: JSON.stringify(data ?? null, null, 2) }],
          structuredContent: structured,
        });
      } catch (err) {
        unstable_rethrow(err);
        if (err instanceof ApiError && err.status === 401) throw err;
        const message = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String(err.message) : "Tool failed";
        return rpcResult(msg.id, { isError: true, content: [{ type: "text", text: message }] });
      }
    }
    default:
      if (msg.id === undefined) return null; // notifications (e.g. notifications/initialized) need no reply
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }

  let ctx: ToolContext | undefined;
  const getCtx = async () => (ctx ??= await authenticate(req));

  try {
    // Every request needs a valid user, even tools/list, so a stranger can't probe the server.
    await getCtx();
    const batch = Array.isArray(body) ? (body as RpcRequest[]) : [body as RpcRequest];
    const replies = (await Promise.all(batch.map((m) => handle(m, getCtx)))).filter(Boolean);
    if (!replies.length) return new NextResponse(null, { status: 202 });
    return NextResponse.json(Array.isArray(body) ? replies : replies[0], {
      headers: { "MCP-Protocol-Version": req.headers.get("mcp-protocol-version") ?? SUPPORTED_VERSIONS[0] },
    });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ApiError && err.status === 401) {
      return NextResponse.json(rpcError(null, -32001, err.message), {
        status: 401,
        headers: { "WWW-Authenticate": 'Bearer realm="grind"' },
      });
    }
    console.error("[mcp] unhandled error", err);
    return NextResponse.json(rpcError(null, -32603, "Internal error"), { status: 500 });
  }
}

/** This server never pushes server-initiated messages, so there is no SSE stream. */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

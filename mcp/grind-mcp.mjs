#!/usr/bin/env node
/**
 * Grind MCP bridge (stdio). Lets any MCP client (Claude Desktop, Claude Code, Cursor, …) talk to Grind.
 *
 * It signs in to Supabase as you (email + password), keeps the access token fresh, and forwards
 * each JSON-RPC message to the app's /api/mcp endpoint. Tools live in src/modules/mcp/tools.ts.
 *
 * Env:
 *   GRIND_EMAIL, GRIND_PASSWORD   your Grind login (required)
 *   GRIND_URL                     app URL (default http://localhost:3000)
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *                                 read from .env.local next to package.json when not set
 *
 * stdout carries protocol messages only; diagnostics go to stderr.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const log = (...args) => console.error("[grind-mcp]", ...args);

function loadEnvFile(file) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // optional
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const APP_URL = (process.env.GRIND_URL || "http://localhost:3000").replace(/\/$/, "");
const { NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: SUPABASE_KEY, GRIND_EMAIL, GRIND_PASSWORD } =
  process.env;

const fatal = (msg) => {
  log(msg);
  process.exit(1);
};
if (!SUPABASE_URL || !SUPABASE_KEY) fatal("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or run from the repo with .env.local).");
if (!GRIND_EMAIL || !GRIND_PASSWORD) fatal("Set GRIND_EMAIL and GRIND_PASSWORD to your Grind login.");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
});

let signingIn = null;
async function signIn() {
  signingIn ??= supabase.auth
    .signInWithPassword({ email: GRIND_EMAIL, password: GRIND_PASSWORD })
    .then(({ data, error }) => {
      if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message ?? "no session"}`);
      log("signed in as", data.user.email);
      return data.session;
    })
    .finally(() => {
      signingIn = null;
    });
  return signingIn;
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  // Refresh a minute early so a request never carries an expiring token.
  if (session && session.expires_at && session.expires_at * 1000 - Date.now() > 60_000) return session.access_token;
  if (session) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (!error && refreshed.session) return refreshed.session.access_token;
  }
  return (await signIn()).access_token;
}

async function forward(message, retried = false) {
  const res = await fetch(`${APP_URL}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify(message),
  });
  if (res.status === 401 && !retried) {
    await signIn();
    return forward(message, true);
  }
  if (res.status === 202) return null;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Grind returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
let pending = 0;
let closed = false;
// When the client closes stdin, stop the token refresh timer and let Node exit on its own.
// (Calling process.exit while fetch sockets are closing trips a libuv assertion on Windows.)
const shutdown = () => {
  supabase.auth.stopAutoRefresh().catch(() => {});
  process.exitCode = 0;
};
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  pending++;
  try {
    const reply = await forward(message);
    if (reply) send(reply);
  } catch (err) {
    log(err.message);
    if (message.id !== undefined) {
      const hint = /fetch failed|ECONNREFUSED/i.test(err.message) ? ` (is Grind running at ${APP_URL}?)` : "";
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: `${err.message}${hint}` } });
    }
  } finally {
    pending--;
    if (closed && pending === 0) shutdown();
  }
});
rl.on("close", () => {
  closed = true;
  if (pending === 0) shutdown();
});

log(`forwarding to ${APP_URL}/api/mcp`);

"use client";

import { Bot, Check, Copy } from "lucide-react";
import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";

const CONFIG = `{
  "mcpServers": {
    "grind": {
      "command": "node",
      "args": ["<path-to-repo>/mcp/grind-mcp.mjs"],
      "env": {
        "GRIND_URL": "http://localhost:3000",
        "GRIND_EMAIL": "you@example.com",
        "GRIND_PASSWORD": "your-grind-password"
      }
    }
  }
}`;

/** Shows how to plug Grind into Claude Desktop, Cursor, Claude Code or any MCP client. */
export function McpConnectCard() {
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <CardTitle>Connect other AIs (MCP)</CardTitle>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Bot className="h-5 w-5" />
        </span>
        <p className="text-sm text-muted">
          Let Claude, Cursor or any MCP client read your day, log meals and sets, and edit targets. Add this to the
          client&apos;s MCP config (paths and login are yours):
        </p>
      </div>
      <div className="relative">
        <pre className="overflow-x-auto rounded-xl bg-background p-3 text-[11px] leading-relaxed text-muted">{CONFIG}</pre>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(CONFIG).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          aria-label="Copy config"
          className="absolute top-2 right-2 rounded-lg bg-surface-2 p-1.5 text-muted hover:text-foreground"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        HTTP clients can also call <code className="text-foreground">/api/mcp</code> directly with an{" "}
        <code className="text-foreground">Authorization: Bearer</code> Supabase access token.
      </p>
    </Card>
  );
}

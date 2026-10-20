"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Skeleton } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { InsightsReport } from "../schemas";

const insightsKey = ["coach", "insights"] as const;

const TREND = {
  improving: { icon: TrendingUp, className: "text-success" },
  stalled: { icon: Minus, className: "text-warning" },
  declining: { icon: TrendingDown, className: "text-danger" },
  new: { icon: Sparkles, className: "text-accent" },
} as const;

export function InsightsCard() {
  const qc = useQueryClient();
  const { data: report, isPending } = useQuery({
    queryKey: insightsKey,
    queryFn: () => api.get<InsightsReport | null>("/coach/insights"),
  });
  const generate = useMutation({
    mutationFn: () => api.post<InsightsReport>("/coach/insights"),
    onSuccess: (r) => qc.setQueryData(insightsKey, r),
  });

  const insights = report?.content;

  return (
    <Card>
      <CardTitle
        action={
          <Button size="sm" variant="secondary" loading={generate.isPending} onClick={() => generate.mutate()}>
            <Sparkles className="h-4 w-4" /> {insights ? "Refresh" : "Analyse"}
          </Button>
        }
      >
        AI coach
      </CardTitle>

      {isPending || generate.isPending ? <Skeleton className="h-24" /> : null}

      {!insights && !isPending && !generate.isPending ? (
        <p className="text-sm text-muted">
          Get progression targets for every exercise, muscle balance and warnings from your last 8 weeks.
        </p>
      ) : null}

      {insights && !generate.isPending ? (
        <div className="flex flex-col gap-3">
          <div>
            <p className="font-semibold">{insights.headline}</p>
            <p className="text-xs text-muted">
              {insights.consistency} · {relativeTime(report.created_at)}
            </p>
          </div>

          {insights.warnings.length ? (
            <ul className="space-y-1">
              {insights.warnings.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          ) : null}

          <ul className="divide-y divide-border/60">
            {insights.exercises.map((e) => {
              const { icon: Icon, className } = TREND[e.trend];
              return (
                <li key={e.exercise} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className={cn("h-4 w-4", className)} /> {e.exercise}
                    </span>
                    <span className="text-xs text-muted tabular-nums">{e.last_best}</span>
                  </div>
                  <p className="mt-0.5 pl-6">
                    Next: <span className="font-semibold text-accent">{e.next_target}</span>
                  </p>
                  <p className="pl-6 text-xs text-muted">{e.advice}</p>
                </li>
              );
            })}
          </ul>

          {insights.muscle_balance.length ? (
            <div className="flex flex-wrap gap-1.5">
              {insights.muscle_balance.map((m) => (
                <Badge
                  key={m.muscle}
                  className={cn(
                    "capitalize",
                    m.status === "low" && "bg-warning/15 text-warning",
                    m.status === "high" && "bg-danger/15 text-danger",
                    m.status === "ok" && "bg-success/15 text-success",
                  )}
                >
                  {m.muscle} {m.weekly_sets}
                </Badge>
              ))}
            </div>
          ) : null}

          <p className="rounded-xl bg-surface-2 p-3 text-sm">
            <span className="font-medium">Next session: </span>
            {insights.next_session_focus}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

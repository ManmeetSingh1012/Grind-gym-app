"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Card, CardTitle, Progress } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import { MICRONUTRIENTS } from "../nutrients";
import type { NutritionTargets, NutritionTotals } from "../schemas";

function tone(value: number, target: number, kind: "target" | "limit") {
  const pct = target ? value / target : 0;
  if (kind === "limit") return pct > 1 ? "danger" : pct > 0.85 ? "warning" : "success";
  return pct >= 1 ? "success" : "accent";
}

export function CaloriesRing({ eaten, target }: { eaten: number; target: number }) {
  const pct = target ? Math.min(1, eaten / target) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const over = eaten > target;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} className="fill-none stroke-surface-2" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className={cn("fill-none transition-all", over ? "stroke-danger" : "stroke-accent")}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{formatNumber(Math.abs(target - eaten))}</span>
        <span className="text-xs text-muted">{over ? "kcal over" : "kcal left"}</span>
      </div>
    </div>
  );
}

export function MacroSummary({ totals, targets }: { totals: NutritionTotals; targets: NutritionTargets }) {
  const macros = [
    { label: "Protein", value: totals.protein_g, target: targets.protein_g },
    { label: "Carbs", value: totals.carbs_g, target: targets.carbs_g },
    { label: "Fat", value: totals.fat_g, target: targets.fat_g },
  ];
  return (
    <Card className="flex items-center gap-4">
      <CaloriesRing eaten={totals.calories} target={targets.calories} />
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{formatNumber(totals.calories)}</span>
          <span className="text-muted"> / {formatNumber(targets.calories)} kcal</span>
        </p>
        {macros.map((m) => (
          <div key={m.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted">{m.label}</span>
              <span className="tabular-nums">
                {formatNumber(m.value)}/{formatNumber(m.target)} g
              </span>
            </div>
            <Progress value={m.value} max={m.target} tone={m.label === "Protein" && m.value >= m.target ? "success" : "accent"} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function MicroSummary({ totals, targets }: { totals: NutritionTotals; targets: NutritionTargets }) {
  const [expanded, setExpanded] = useState(false);
  const rows = MICRONUTRIENTS.map((n) => ({
    ...n,
    value: totals.micros[n.key] ?? 0,
    target: targets.micros[n.key] ?? n.male,
  }));
  // Collapsed view: the nutrients furthest from target first (or over a limit).
  const sorted = [...rows].sort((a, b) => score(a) - score(b));
  const visible = expanded ? rows : sorted.slice(0, 6);

  return (
    <Card>
      <CardTitle
        action={
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-accent">
            {expanded ? "Show less" : `All ${rows.length}`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition", expanded && "rotate-180")} />
          </button>
        }
      >
        Vitamins & minerals
      </CardTitle>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {visible.map((n) => (
          <div key={n.key}>
            <div className="mb-1 flex justify-between text-xs">
              <span className={cn(n.kind === "limit" ? "text-muted italic" : "text-muted")}>
                {n.label}
                {n.kind === "limit" ? " (limit)" : ""}
              </span>
              <span className="tabular-nums">
                {formatNumber(n.value, 1)}/{formatNumber(n.target, 1)} {n.unit}
              </span>
            </div>
            <Progress value={n.value} max={n.target} tone={tone(n.value, n.target, n.kind)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Lower = needs more attention. Limits that are exceeded sort first. */
function score(n: { value: number; target: number; kind: "target" | "limit" }) {
  const pct = n.target ? n.value / n.target : 1;
  return n.kind === "limit" ? (pct > 1 ? -1 : 2) : pct;
}

"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Card, CardTitle, Progress } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import { MICRONUTRIENTS } from "../nutrients";
import type { NutritionTargets, NutritionTotals } from "../schemas";

type Kind = "target" | "limit";

function tone(value: number, target: number, kind: Kind) {
  const pct = target ? value / target : 0;
  if (kind === "limit") return pct > 1 ? "danger" : pct > 0.85 ? "warning" : "success";
  return pct >= 1 ? "success" : "accent";
}

/** "62 g left", "Done", or "12 g over" for a nutrient. */
function Remaining({ value, target, unit, kind, digits = 0 }: { value: number; target: number; unit: string; kind: Kind; digits?: number }) {
  const left = target - value;
  if (left < 0) {
    return (
      <span className={cn("font-semibold tabular-nums", kind === "limit" ? "text-danger" : "text-success")}>
        {formatNumber(-left, digits)} {unit} over
      </span>
    );
  }
  if (kind === "target" && left <= target * 0.02) {
    return (
      <span className="flex items-center gap-1 font-semibold text-success">
        <Check className="h-3.5 w-3.5" /> Done
      </span>
    );
  }
  return (
    <span className="font-semibold tabular-nums">
      {formatNumber(left, digits)} {unit} <span className="font-normal text-muted">left</span>
    </span>
  );
}

export function CaloriesRing({ eaten, target, size = "md" }: { eaten: number; target: number; size?: "md" | "lg" }) {
  const pct = target ? Math.min(1, eaten / target) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const over = eaten > target;
  return (
    <div className={cn("relative shrink-0", size === "lg" ? "h-36 w-36" : "h-32 w-32")}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} className="fill-none stroke-surface-2" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className={cn("fill-none transition-all duration-700", over ? "stroke-danger" : "stroke-accent")}
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
    { label: "Protein", value: totals.protein_g, target: targets.protein_g, color: "bg-accent" },
    { label: "Carbs", value: totals.carbs_g, target: targets.carbs_g, color: "bg-sky-400" },
    { label: "Fat", value: totals.fat_g, target: targets.fat_g, color: "bg-warning" },
  ];
  return (
    <Card className="flex items-center gap-4">
      <CaloriesRing eaten={totals.calories} target={targets.calories} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{formatNumber(totals.calories)}</span>
          <span className="text-muted"> eaten of {formatNumber(targets.calories)} kcal</span>
        </p>
        {macros.map((m) => (
          <div key={m.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <span className={cn("h-2 w-2 rounded-full", m.color)} />
                {m.label}
              </span>
              <Remaining value={m.value} target={m.target} unit="g" kind="target" />
            </div>
            <Progress value={m.value} max={m.target} tone={m.value >= m.target ? "success" : "accent"} />
            <p className="mt-0.5 text-[10px] text-muted tabular-nums">
              {formatNumber(m.value)} / {formatNumber(m.target)} g
            </p>
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
  // Collapsed view: the nutrients that need the most attention first (exceeded limits, then lowest %).
  const sorted = [...rows].sort((a, b) => score(a) - score(b));
  const visible = expanded ? rows : sorted.slice(0, 6);
  const met = rows.filter((n) => (n.kind === "target" ? n.value >= n.target * 0.98 : n.value <= n.target)).length;

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
        Vitamins & minerals · {met}/{rows.length} on track
      </CardTitle>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {visible.map((n) => {
          const digits = n.target < 10 ? 1 : 0;
          return (
            <div key={n.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted">
                  {n.label}
                  {n.kind === "limit" ? <span className="ml-1 text-[10px] uppercase">limit</span> : null}
                </span>
                <Remaining value={n.value} target={n.target} unit={n.unit} kind={n.kind} digits={digits} />
              </div>
              <Progress value={n.value} max={n.target} tone={tone(n.value, n.target, n.kind)} />
              <p className="mt-0.5 text-[10px] text-muted tabular-nums">
                {formatNumber(n.value, digits)} / {formatNumber(n.target, digits)} {n.unit}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Lower = needs more attention. Exceeded limits sort first. */
function score(n: { value: number; target: number; kind: Kind }) {
  const pct = n.target ? n.value / n.target : 1;
  return n.kind === "limit" ? (pct > 1 ? -1 : 2) : pct;
}

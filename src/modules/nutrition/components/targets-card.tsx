"use client";

import {
  AlertTriangle,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  Minus,
  Repeat,
  ScanLine,
  SlidersHorizontal,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { formatDate } from "@/lib/dates";
import { cn, formatNumber } from "@/lib/utils";
import type { GoalType } from "@/modules/goals/schemas";
import { useSaveCalculatedTargets, useTargetPreview } from "../hooks";
import type { NutritionTargets, Pace, TargetCalculation } from "../schemas";
import { GOALS_WITH_PACE, WEEKLY_CHANGE_KG } from "../targets";

const GOAL_OPTIONS: { value: GoalType; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "lose_fat", label: "Lose fat", hint: "Calorie deficit, keep muscle", icon: Flame },
  { value: "build_muscle", label: "Build muscle", hint: "Lean surplus for growth", icon: Dumbbell },
  { value: "recomp", label: "Recomp", hint: "Lose fat & gain muscle", icon: Repeat },
  { value: "strength", label: "Get stronger", hint: "Fuel heavy training", icon: Trophy },
  { value: "endurance", label: "Endurance", hint: "Fuel for cardio", icon: HeartPulse },
  { value: "maintain", label: "Maintain", hint: "Stay where you are", icon: Minus },
];

const PACES: Pace[] = ["slow", "moderate", "fast"];
const PACE_PERCENT: Partial<Record<GoalType, Record<Pace, string>>> = {
  recomp: { slow: "−5%", moderate: "−10%", fast: "−15%" },
  strength: { slow: "+3%", moderate: "+5%", fast: "+10%" },
};

function paceHint(goal: GoalType, pace: Pace) {
  const kg = WEEKLY_CHANGE_KG[goal]?.[pace];
  if (kg != null) return `${kg > 0 ? "+" : "−"}${Math.abs(kg)} kg/wk`;
  return `${PACE_PERCENT[goal]?.[pace] ?? ""} kcal`;
}

const goalLabel = (g?: GoalType | null) => GOAL_OPTIONS.find((o) => o.value === g)?.label ?? "Maintain";
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${formatNumber(Math.abs(n))}`;

/** Summary of today's targets with a button to recalculate them from a goal + pace. */
export function TargetsCard({ targets }: { targets: NutritionTargets }) {
  const [open, setOpen] = useState(false);
  const c = targets.calculation;
  const goal = targets.goal_type ?? c?.goal ?? null;

  const subtitle =
    targets.source === "ai_plan"
      ? "From your AI plan"
      : targets.source === "manual"
        ? "Custom targets"
        : [goalLabel(goal), c?.pace ? capitalize(c.pace) : null, c?.weekly_change_kg ? `${c.weekly_change_kg > 0 ? "+" : ""}${c.weekly_change_kg} kg/wk` : null]
            .filter(Boolean)
            .join(" · ");

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full text-left">
        <Card className="flex items-center gap-3 bg-gradient-to-br from-accent/10 via-surface to-surface">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Daily target</p>
            <p className="text-lg font-bold tabular-nums">
              {formatNumber(targets.calories)} kcal
              <span className="ml-2 text-sm font-normal text-muted">
                P {formatNumber(targets.protein_g)} · C {formatNumber(targets.carbs_g)} · F {formatNumber(targets.fat_g)}
              </span>
            </p>
            <p className="truncate text-xs text-muted">{subtitle}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
        </Card>
      </button>
      {open ? (
        <TargetsSheet
          onClose={() => setOpen(false)}
          initialGoal={goal ?? "recomp"}
          initialPace={targets.pace ?? c?.pace ?? "moderate"}
          replacing={targets.source !== "calculated" ? targets.source : null}
        />
      ) : null}
    </>
  );
}

function TargetsSheet({
  onClose,
  initialGoal,
  initialPace,
  replacing,
}: {
  onClose: () => void;
  initialGoal: GoalType;
  initialPace: Pace;
  replacing: "ai_plan" | "manual" | null;
}) {
  const [goal, setGoal] = useState<GoalType>(initialGoal);
  const [pace, setPace] = useState<Pace>(initialPace);
  const preview = useTargetPreview({ goal, pace }, true);
  const save = useSaveCalculatedTargets();
  const hasPace = GOALS_WITH_PACE.includes(goal);
  const t = preview.data;

  return (
    <Sheet open onClose={onClose} title="Set your daily target">
      <div className="flex flex-col gap-5">
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">1 · Your goal</h4>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map(({ value, label, hint, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setGoal(value)}
                className={cn(
                  "flex items-start gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.98]",
                  goal === value ? "border-accent bg-accent/10" : "border-border bg-surface-2 hover:border-muted/40",
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", goal === value ? "text-accent" : "text-muted")} />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-[11px] leading-tight text-muted">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {hasPace ? (
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">2 · Pace</h4>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
              {PACES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPace(p)}
                  className={cn(
                    "rounded-xl py-2 text-center transition",
                    pace === p ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground",
                  )}
                >
                  <span className="block text-sm font-semibold capitalize">{p}</span>
                  <span className={cn("block text-[11px]", pace === p ? "text-accent-foreground/70" : "text-muted")}>
                    {paceHint(goal, p)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className={cn("transition-opacity", preview.isFetching && "opacity-60")}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {hasPace ? "3" : "2"} · Your numbers
          </h4>
          {t?.calculation ? (
            <Breakdown targets={t} calc={t.calculation} />
          ) : preview.error ? (
            <p className="text-sm text-danger">{preview.error.message}</p>
          ) : (
            <div className="h-48 animate-pulse rounded-2xl bg-surface-2" />
          )}
        </section>

        {replacing ? (
          <p className="text-xs text-warning">
            Saving replaces your {replacing === "ai_plan" ? "AI plan" : "custom"} targets.
          </p>
        ) : null}
        <Button
          size="lg"
          loading={save.isPending}
          disabled={!t}
          onClick={() =>
            save.mutate(
              { goal, pace },
              {
                onSuccess: (saved) => {
                  toast.success(`Daily target set: ${formatNumber(saved.calories)} kcal`);
                  onClose();
                },
              },
            )
          }
        >
          Save as my daily target
        </Button>
      </div>
    </Sheet>
  );
}

function Breakdown({ targets, calc }: { targets: NutritionTargets; calc: TargetCalculation }) {
  const macros = [
    { label: "Protein", g: targets.protein_g, kcal: targets.protein_g * 4, color: "bg-accent" },
    { label: "Carbs", g: targets.carbs_g, kcal: targets.carbs_g * 4, color: "bg-sky-400" },
    { label: "Fat", g: targets.fat_g, kcal: targets.fat_g * 9, color: "bg-warning" },
  ];
  const total = macros.reduce((s, m) => s + m.kcal, 0) || 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-surface-2 p-4 text-center">
        <p className="text-4xl font-bold tracking-tight tabular-nums">{formatNumber(targets.calories)}</p>
        <p className="text-sm text-muted">kcal per day</p>
        {calc.weekly_change_kg ? (
          <p className={cn("mt-1 text-sm font-medium", calc.weekly_change_kg < 0 ? "text-success" : "text-accent")}>
            Expected {calc.weekly_change_kg > 0 ? "+" : ""}
            {calc.weekly_change_kg} kg per week
          </p>
        ) : null}
      </div>

      <ol className="rounded-2xl border border-border text-sm">
        <Step
          label="Base metabolism (BMR)"
          detail={
            calc.bmr_source === "scan"
              ? `Measured on your scan${calc.scan_date ? ` · ${formatDate(calc.scan_date)}` : ""}`
              : "Estimated from age, height & weight"
          }
          value={`${formatNumber(calc.bmr)}`}
        />
        <Step
          label={`× ${calc.activity_factor} activity`}
          detail={`${capitalize(calc.activity_level.replace("_", " "))} · change in Profile`}
          value={`= ${formatNumber(calc.maintenance)}`}
          sub="Maintenance"
        />
        <Step
          label="Goal adjustment"
          detail={calc.floored ? "Limited to a safe minimum intake" : goalLabel(calc.goal)}
          value={signed(calc.adjustment)}
        />
        <Step label="Daily target" value={`${formatNumber(targets.calories)} kcal`} strong />
      </ol>

      <div>
        <div className="mb-2 flex h-2.5 overflow-hidden rounded-full">
          {macros.map((m) => (
            <div key={m.label} className={m.color} style={{ width: `${(m.kcal / total) * 100}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {macros.map((m) => (
            <div key={m.label} className="rounded-xl bg-surface-2 py-2">
              <p className="flex items-center justify-center gap-1.5 text-[11px] uppercase text-muted">
                <span className={cn("h-2 w-2 rounded-full", m.color)} /> {m.label}
              </p>
              <p className="text-lg font-bold tabular-nums">{formatNumber(m.g)} g</p>
              <p className="text-[11px] text-muted">{Math.round((m.kcal / total) * 100)}%</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Protein: {calc.protein_per_kg} g per kg of {calc.lean_mass_kg ? `lean mass (${calc.lean_mass_kg} kg)` : `body weight (${calc.weight_kg} kg)`}
          . Vitamins & minerals are set for your sex and calorie level.
        </p>
      </div>

      {calc.missing_profile.length ? (
        <Link href="/profile" className="flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Add your {calc.missing_profile.join(", ")} in Profile for accurate numbers.
        </Link>
      ) : null}
      {calc.bmr_source === "formula" ? (
        <Link href="/body" className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted">
          <ScanLine className="h-4 w-4 shrink-0 text-accent" />
          Upload a body composition test to use your measured BMR and lean mass.
        </Link>
      ) : null}
    </div>
  );
}

function Step({ label, detail, value, sub, strong }: { label: string; detail?: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <li className={cn("flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-0", strong && "bg-accent/5")}>
      <span className="min-w-0">
        <span className={cn("block", strong ? "font-semibold" : "font-medium")}>{label}</span>
        {detail ? <span className="block text-xs text-muted">{detail}</span> : null}
      </span>
      <span className="shrink-0 text-right tabular-nums">
        <span className={cn("block", strong ? "font-bold text-accent" : "font-semibold")}>{value}</span>
        {sub ? <span className="block text-[11px] text-muted">{sub}</span> : null}
      </span>
    </li>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

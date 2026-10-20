"use client";

import { ArrowRightLeft, CheckCircle2, Footprints, Minus, Pencil, Plus, Sparkles, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Skeleton } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { relativeTime } from "@/lib/dates";
import { cn, formatNumber } from "@/lib/utils";
import { WEEKDAYS } from "@/modules/workouts/schemas";
import { useApplyPlan, useGeneratePlan, usePlan } from "../hooks";
import type { BodyPlan } from "../schemas";

const DAY_NAME = (n: number) => WEEKDAYS.find((d) => d.value === n)?.long ?? "Sunday";

const ACTION_STYLE = {
  keep: { icon: CheckCircle2, className: "text-success" },
  modify: { icon: Pencil, className: "text-warning" },
  replace: { icon: ArrowRightLeft, className: "text-accent" },
  remove: { icon: Minus, className: "text-danger" },
  add: { icon: Plus, className: "text-accent" },
} as const;

export function PlanSection() {
  const { data: plan, isPending } = usePlan();
  const generate = useGeneratePlan();
  const apply = useApplyPlan();
  const [notes, setNotes] = useState("");

  return (
    <section className="flex flex-col gap-3">
      <Card>
        <CardTitle>AI diet, gym & cardio plan</CardTitle>
        <p className="mb-3 text-sm text-muted">
          Uses your latest scan, active goal, profile and logged workouts. Takes up to a minute or two.
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional: vegetarian, knee pain, 1 hour per session, budget…"
          className="min-h-16"
        />
        <Button
          className="mt-3 w-full"
          loading={generate.isPending}
          onClick={() =>
            generate.mutate({ notes: notes || undefined }, { onSuccess: () => toast.success("Your plan is ready") })
          }
        >
          <Sparkles className="h-4 w-4" /> {generate.isPending ? "Building your plan…" : plan ? "Regenerate plan" : "Create my plan"}
        </Button>
      </Card>

      {isPending || generate.isPending ? <Skeleton className="h-64" /> : null}

      {plan && !generate.isPending ? (
        <>
          <PlanView plan={plan.content} createdAt={plan.created_at} />
          <Card className="flex flex-col gap-2">
            <CardTitle>Use this plan</CardTitle>
            <Button
              variant="secondary"
              loading={apply.isPending && apply.variables?.nutrition && !apply.variables.training}
              onClick={() =>
                apply.mutate(
                  { id: plan.id, nutrition: true, training: false },
                  { onSuccess: () => toast.success("Nutrition targets updated") },
                )
              }
            >
              Apply nutrition targets
            </Button>
            <Button
              variant="secondary"
              loading={apply.isPending && apply.variables?.training}
              onClick={() => {
                if (!confirm("Replace your weekly routine with this plan's split? Your logged sets are kept.")) return;
                apply.mutate(
                  { id: plan.id, nutrition: false, training: true },
                  { onSuccess: () => toast.success("Weekly routine updated") },
                );
              }}
            >
              Apply training split to my week
            </Button>
          </Card>
        </>
      ) : null}
    </section>
  );
}

function PlanView({ plan, createdAt }: { plan: BodyPlan; createdAt: string }) {
  const n = plan.nutrition;
  return (
    <>
      <Card className="border-accent/30">
        <p className="text-xs text-muted">Generated {relativeTime(createdAt)}</p>
        <p className="mt-1">{plan.summary}</p>
        <p className="mt-3 text-sm text-muted">{plan.assessment.current_state}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {plan.assessment.key_findings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </Card>

      {plan.exercise_adjustments.length ? (
        <Card>
          <CardTitle>Changes to your current exercises</CardTitle>
          <ul className="flex flex-col gap-3">
            {plan.exercise_adjustments.map((a, i) => {
              const { icon: Icon, className } = ACTION_STYLE[a.action];
              return (
                <li key={i} className="flex gap-3">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} />
                  <div className="text-sm">
                    <p>
                      <span className="font-semibold">{a.exercise}</span>{" "}
                      <Badge className={cn("ml-1 capitalize", className)}>{a.action}</Badge>
                    </p>
                    <p className="mt-0.5">{a.change}</p>
                    <p className="mt-0.5 text-xs text-muted">{a.reason}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Nutrition</CardTitle>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["kcal", n.calories],
            ["Protein", n.protein_g],
            ["Carbs", n.carbs_g],
            ["Fat", n.fat_g],
          ].map(([label, v]) => (
            <div key={label} className="rounded-xl bg-surface-2 py-2">
              <p className="text-lg font-bold tabular-nums">{formatNumber(Number(v))}</p>
              <p className="text-[10px] uppercase text-muted">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Water: {n.hydration_l} L / day</p>

        <h4 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sample day</h4>
        <ul className="flex flex-col gap-2">
          {n.meal_plan.map((m, i) => (
            <li key={i} className="rounded-xl bg-surface-2 p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">
                  {m.meal} <span className="text-muted">· {m.time}</span>
                </span>
                <span className="tabular-nums text-muted">
                  {formatNumber(m.calories)} kcal · {formatNumber(m.protein_g)}g P
                </span>
              </div>
              <p className="mt-1 text-muted">{m.foods.join(", ")}</p>
            </li>
          ))}
        </ul>

        {n.micro_focus.length ? (
          <>
            <h4 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Micronutrient focus</h4>
            <ul className="space-y-1.5 text-sm">
              {n.micro_focus.map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.nutrient}</span> <span className="text-accent">{m.target}</span>
                  <span className="block text-xs text-muted">{m.why}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {n.tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Training · {plan.training.split_name}</CardTitle>
        <div className="flex flex-col gap-3">
          {plan.training.days.map((d) => (
            <div key={d.weekday}>
              <p className="text-sm font-semibold">
                {DAY_NAME(d.weekday)} <span className="font-normal text-muted">· {d.focus}</span>
              </p>
              <ul className="mt-1 text-sm">
                {d.exercises.map((e, i) => (
                  <li key={i} className="flex justify-between border-b border-border/50 py-1">
                    <span>{e.name}</span>
                    <span className="tabular-nums text-muted">
                      {e.sets}×{e.reps} · {e.rest_sec}s
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium text-foreground">Progression: </span>
          {plan.training.progression}
        </p>
      </Card>

      <Card>
        <CardTitle>Cardio</CardTitle>
        <p className="mb-2 flex items-center gap-2 text-sm">
          <Footprints className="h-4 w-4 text-accent" /> {formatNumber(plan.cardio.daily_steps)} steps / day
        </p>
        <ul className="space-y-2 text-sm">
          {plan.cardio.sessions.map((s, i) => (
            <li key={i}>
              <span className="font-medium">{DAY_NAME(s.weekday)}</span>: {s.type}, {s.duration_min} min ·{" "}
              <span className="text-muted">{s.intensity}</span>
              {s.notes ? <span className="block text-xs text-muted">{s.notes}</span> : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Milestones</CardTitle>
        <ul className="space-y-2 text-sm">
          {plan.milestones.map((m, i) => (
            <li key={i} className="flex gap-3">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="font-medium">Week {m.week}:</span> {m.target}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

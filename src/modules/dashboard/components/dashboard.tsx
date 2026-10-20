"use client";

import { ChevronRight, Dumbbell, Target } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/bottom-nav";
import { Card, CardTitle, Progress, Skeleton } from "@/components/ui/card";
import { formatDate, isoWeekday, toIsoDate } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";
import { useScans } from "@/modules/body/hooks";
import { InsightsCard } from "@/modules/coach/components/insights-card";
import { useGoals } from "@/modules/goals/hooks";
import { GOAL_LABELS } from "@/modules/goals/schemas";
import { CaloriesRing } from "@/modules/nutrition/components/day-totals";
import { useDaySummary } from "@/modules/nutrition/hooks";
import { useProfile } from "@/modules/profile/components/profile-form";
import { useRoutine } from "@/modules/workouts/hooks";
import { WEEKDAYS } from "@/modules/workouts/schemas";

export function Dashboard() {
  const date = toIsoDate();
  const weekday = isoWeekday();
  const profile = useProfile();
  const routine = useRoutine(weekday, date);
  const food = useDaySummary(date);
  const goals = useGoals();
  const scans = useScans();

  const goal = goals.data?.find((g) => g.is_active);
  const latestScan = scans.data?.[0];
  const dayName = WEEKDAYS.find((d) => d.value === weekday)?.long ?? "Sunday";
  const items = routine.data ?? [];
  const exercisesDone = items.filter((i) => i.todaySets.length > 0).length;

  return (
    <>
      <PageHeader
        title={`Hey${profile.data?.display_name ? `, ${profile.data.display_name}` : ""} 👊`}
        subtitle={`${dayName}, ${formatDate(date)}`}
      />

      <div className="flex flex-col gap-3">
        {goal ? (
          <Link href="/profile">
            <Card className="flex items-center gap-3">
              <Target className="h-5 w-5 text-accent" />
              <div className="flex-1">
                <p className="font-semibold">{goal.title}</p>
                <p className="text-xs text-muted">
                  {GOAL_LABELS[goal.type]}
                  {goal.target_weight_kg && latestScan?.weight_kg
                    ? ` · ${formatNumber(Math.abs(latestScan.weight_kg - goal.target_weight_kg), 1)} kg to go`
                    : ""}
                  {goal.target_body_fat_pct && latestScan?.body_fat_pct
                    ? ` · ${formatNumber(latestScan.body_fat_pct, 1)}% → ${goal.target_body_fat_pct}% BF`
                    : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted" />
            </Card>
          </Link>
        ) : goals.data ? (
          <Link href="/profile">
            <Card className="border-dashed text-sm text-muted">+ Set a goal to personalise your plan and targets</Card>
          </Link>
        ) : null}

        <Link href="/workouts">
          <Card>
            <CardTitle action={<ChevronRight className="h-4 w-4 text-muted" />}>Today&apos;s workout</CardTitle>
            {routine.isPending ? (
              <Skeleton className="h-12" />
            ) : weekday === 7 ? (
              <p className="text-sm text-muted">Sunday — rest and recover.</p>
            ) : items.length ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-accent" />
                  <span className="text-sm">
                    {exercisesDone}/{items.length} exercises ·{" "}
                    {items.reduce((n, i) => n + i.todaySets.length, 0)} sets
                  </span>
                </div>
                <Progress value={exercisesDone} max={items.length} />
                <p className="mt-2 truncate text-xs text-muted">{items.map((i) => i.exercise.name).join(" · ")}</p>
              </>
            ) : (
              <p className="text-sm text-muted">No exercises planned for {dayName}. Tap to add some.</p>
            )}
          </Card>
        </Link>

        <Link href="/nutrition">
          <Card className="flex items-center gap-4">
            {food.data ? (
              <>
                <CaloriesRing eaten={food.data.totals.calories} target={food.data.targets.calories} />
                <div className="flex flex-1 flex-col gap-2 text-sm">
                  <p className="font-semibold">Nutrition today</p>
                  {(
                    [
                      ["Protein", food.data.totals.protein_g, food.data.targets.protein_g],
                      ["Carbs", food.data.totals.carbs_g, food.data.targets.carbs_g],
                      ["Fat", food.data.totals.fat_g, food.data.targets.fat_g],
                    ] as const
                  ).map(([label, v, t]) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-muted">
                        <span>{label}</span>
                        <span className="tabular-nums">
                          {formatNumber(v)}/{formatNumber(t)} g
                        </span>
                      </div>
                      <Progress value={v} max={t} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Skeleton className="h-32 w-full" />
            )}
          </Card>
        </Link>

        <InsightsCard />

        {latestScan ? (
          <Link href="/body">
            <Card>
              <CardTitle action={<ChevronRight className="h-4 w-4 text-muted" />}>
                Body · {formatDate(latestScan.scanned_on)}
              </CardTitle>
              <div className="grid grid-cols-3 text-center">
                <Metric label="Weight" value={latestScan.weight_kg} unit="kg" />
                <Metric label="Body fat" value={latestScan.body_fat_pct} unit="%" />
                <Metric label="Muscle" value={latestScan.skeletal_muscle_kg} unit="kg" />
              </div>
            </Card>
          </Link>
        ) : null}
      </div>
    </>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div>
      <p className="text-lg font-bold tabular-nums">
        {value != null ? formatNumber(value, 1) : "—"}
        <span className="text-xs font-normal text-muted"> {unit}</span>
      </p>
      <p className="text-[10px] uppercase text-muted">{label}</p>
    </div>
  );
}

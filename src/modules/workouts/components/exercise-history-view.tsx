"use client";

import { ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/bottom-nav";
import { Badge, Card, CardTitle, EmptyState, Skeleton } from "@/components/ui/card";
import { formatDate, relativeTime } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";
import { useExerciseHistory } from "../hooks";
import { SetRow } from "./set-editor";

export function ExerciseHistoryView({ exerciseId }: { exerciseId: string }) {
  const { data, isPending, error } = useExerciseHistory(exerciseId);

  if (isPending) return <Skeleton className="mt-6 h-64" />;
  if (error || !data) return <EmptyState title="Couldn't load this exercise">{error?.message}</EmptyState>;

  const { exercise, stats, sessions, byWeight } = data;
  const maxVolume = Math.max(1, ...sessions.map((s) => s.volume));

  return (
    <>
      <Link href="/workouts" className="mt-4 inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader
        title={exercise.name}
        subtitle={[exercise.muscle_group, exercise.equipment].filter(Boolean).join(" · ")}
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Best" value={stats.best ? `${formatNumber(stats.best.weight_kg, 2)}×${stats.best.reps}` : "—"} />
        <Stat label="e1RM" value={stats.estimatedOneRepMax ? `${formatNumber(stats.estimatedOneRepMax, 1)}` : "—"} />
        <Stat label="Updated" value={stats.lastUpdatedAt ? relativeTime(stats.lastUpdatedAt) : "—"} />
      </div>

      {exercise.instructions ? (
        <Card className="mt-3">
          <CardTitle>How to</CardTitle>
          <p className="text-sm whitespace-pre-line text-muted">{exercise.instructions}</p>
          {exercise.source_url ? (
            <a href={exercise.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-accent">
              Source <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </Card>
      ) : null}

      {byWeight.length ? (
        <Card className="mt-3">
          <CardTitle>Last time at each weight</CardTitle>
          <div className="divide-y divide-border/60 text-sm">
            {byWeight.map((r, i) => (
              <div key={r.weight_kg} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 font-semibold tabular-nums">
                  {i === 0 ? <Trophy className="h-3.5 w-3.5 text-warning" /> : null}
                  {formatNumber(r.weight_kg, 2)} kg
                </span>
                <span className="text-muted">best {r.bestReps} reps</span>
                <span className="text-muted">{formatDate(r.lastDate)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <h2 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Sessions</h2>
      {sessions.length === 0 ? <EmptyState title="No sets logged yet" /> : null}
      <div className="flex flex-col gap-3">
        {sessions.map((s) => (
          <Card key={s.date}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">{formatDate(s.date)}</span>
              <Badge>{formatNumber(s.volume)} kg volume</Badge>
            </div>
            <div className="mb-2 h-1 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent/60" style={{ width: `${(s.volume / maxVolume) * 100}%` }} />
            </div>
            <div className="divide-y divide-border/60">
              {s.sets.map((set) => (
                <SetRow key={set.id} set={set} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </Card>
  );
}

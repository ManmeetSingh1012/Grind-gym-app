"use client";

import { ChevronDown, History, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { formatDate, relativeTime } from "@/lib/dates";
import { cn, formatNumber } from "@/lib/utils";
import { useRemoveRoutineItem } from "../hooks";
import type { RoutineItem } from "../schemas";
import { AddSetRow, SetRow } from "./set-editor";

export function ExerciseCard({ item, date }: { item: RoutineItem; date: string }) {
  const [open, setOpen] = useState(item.todaySets.length > 0);
  const remove = useRemoveRoutineItem();
  const { stats, exercise, todaySets } = item;

  // Suggest the next set: repeat today's last set, else the matching set from last session.
  const last = stats.lastSession;
  const suggestion =
    todaySets.at(-1) ?? last?.sets[Math.min(todaySets.length, (last?.sets.length ?? 1) - 1)] ?? undefined;

  return (
    <Card className="p-0">
      <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen(!open)}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{exercise.name}</h3>
            {todaySets.length ? <Badge className="bg-accent/15 text-accent">{todaySets.length} sets</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted capitalize">
            {exercise.muscle_group}
            {exercise.equipment ? ` · ${exercise.equipment}` : ""}
            {item.target_sets ? ` · target ${item.target_sets}×${item.target_reps ?? "?"}` : ""}
          </p>
          {last ? (
            <p className="mt-1.5 text-sm">
              <span className="text-muted">Last {formatDate(last.date)}: </span>
              <span className="tabular-nums">
                {last.sets.map((s) => `${formatNumber(s.weight_kg, 2)}×${s.reps}`).join(", ")}
              </span>
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">No history yet</p>
          )}
        </div>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="border-t border-border px-4 pt-2 pb-4">
          {stats.best || stats.lastUpdatedAt ? (
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {stats.best ? (
                <span className="flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5 text-warning" />
                  Best {formatNumber(stats.best.weight_kg, 2)} kg × {stats.best.reps} ({formatDate(stats.best.date)})
                </span>
              ) : null}
              {stats.estimatedOneRepMax ? <span>e1RM {formatNumber(stats.estimatedOneRepMax, 1)} kg</span> : null}
              {stats.lastUpdatedAt ? <span>Updated {relativeTime(stats.lastUpdatedAt)}</span> : null}
            </div>
          ) : null}

          {item.notes ? <p className="mb-2 text-xs text-muted italic">{item.notes}</p> : null}

          <div className="divide-y divide-border/60">
            {todaySets.map((s) => (
              <SetRow key={s.id} set={s} />
            ))}
          </div>

          <AddSetRow
            key={`${todaySets.length}-${suggestion?.id ?? "none"}`}
            exerciseId={exercise.id}
            date={date}
            suggestion={suggestion}
            byWeight={item.byWeight}
          />

          <div className="mt-3 flex justify-between">
            <Link href={`/workouts/exercise/${exercise.id}`}>
              <Button variant="ghost" size="sm">
                <History className="h-4 w-4" /> History
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="hover:text-danger"
              loading={remove.isPending}
              onClick={() => {
                if (confirm(`Remove ${exercise.name} from this day? Logged sets are kept.`)) remove.mutate(item.id);
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove from day
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

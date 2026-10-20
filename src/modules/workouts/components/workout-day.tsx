"use client";

import { Dumbbell, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { formatDate, isoWeekday, toIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useRoutine } from "../hooks";
import { WEEKDAYS } from "../schemas";
import { AddExerciseSheet } from "./add-exercise-sheet";
import { ExerciseCard } from "./exercise-card";

/** The most recent date (today or earlier) that falls on `weekday`, so past days can be back-filled. */
function dateForWeekday(weekday: number) {
  const today = new Date();
  const back = (isoWeekday(today) - weekday + 7) % 7;
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back));
}

export function WorkoutDay() {
  const today = isoWeekday();
  const [weekday, setWeekday] = useState(today === 7 ? 1 : today);
  const [adding, setAdding] = useState(false);
  const date = dateForWeekday(weekday);
  const routine = useRoutine(weekday, date);
  const day = WEEKDAYS.find((d) => d.value === weekday)!;

  const items = routine.data ?? [];
  const doneSets = items.reduce((n, i) => n + i.todaySets.length, 0);

  return (
    <>
      <PageHeader
        title={day.long}
        subtitle={`${weekday === today ? "Today" : formatDate(date)} · ${items.length} exercises · ${doneSets} sets done`}
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Exercise
          </Button>
        }
      />

      <div className="sticky top-0 z-10 -mx-4 mb-4 bg-background/90 px-4 py-2 backdrop-blur">
        <div className="grid grid-cols-6 gap-1 rounded-2xl bg-surface p-1">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              onClick={() => setWeekday(d.value)}
              className={cn(
                "relative rounded-xl py-2 text-sm font-medium transition",
                d.value === weekday ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {d.short}
              {d.value === today && d.value !== weekday ? (
                <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {routine.isPending ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : items.length === 0 ? (
          <EmptyState icon={<Dumbbell className="h-8 w-8" />} title={`Nothing planned for ${day.long}`}>
            <p>Add exercises by typing or speaking.</p>
            <Button className="mt-4" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add exercise
            </Button>
          </EmptyState>
        ) : (
          items.map((item) => <ExerciseCard key={item.id} item={item} date={date} />)
        )}
      </div>

      <AddExerciseSheet
        open={adding}
        onClose={() => setAdding(false)}
        weekday={weekday}
        weekdayLabel={day.long}
        date={date}
        existingIds={items.map((i) => i.exercise.id)}
      />
    </>
  );
}

"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { formatDate, toIsoDate } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";
import { useDaySummary } from "../hooks";
import { MEALS, type FoodLog, type MealType } from "../schemas";
import { AddFoodSheet } from "./add-food-sheet";
import { MacroSummary, MicroSummary } from "./day-totals";
import { EditFoodSheet } from "./edit-food-sheet";
import { TargetsCard } from "./targets-card";

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function mealForNow(): MealType {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snack";
}

export function NutritionDay() {
  const today = toIsoDate();
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const { data, isPending } = useDaySummary(date);

  return (
    <>
      <PageHeader
        title="Food"
        action={
          <Button size="sm" onClick={() => setAdding(mealForNow())}>
            <Plus className="h-4 w-4" /> Log food
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface p-1">
        <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-medium">{date === today ? "Today" : formatDate(date)}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next day"
          disabled={date >= today}
          onClick={() => setDate(shiftDate(date, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {isPending || !data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <TargetsCard targets={data.targets} />
          <MacroSummary totals={data.totals} targets={data.targets} />

          {MEALS.map((meal) => {
            const logs = data.logs.filter((l) => l.meal === meal);
            const kcal = logs.reduce((s, l) => s + l.calories, 0);
            return (
              <Card key={meal} className="p-0">
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <h3 className="font-semibold">
                    <span className="capitalize">{meal}</span>{" "}
                    {kcal ? <span className="text-sm font-normal text-muted">· {formatNumber(kcal)} kcal</span> : null}
                  </h3>
                  <Button variant="ghost" size="icon-sm" aria-label={`Add to ${meal}`} onClick={() => setAdding(meal)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {logs.length ? (
                  <ul className="pb-2">
                    {logs.map((l) => (
                      <li key={l.id}>
                        <button
                          onClick={() => setEditing(l)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{l.name}</span>
                            <span className="text-xs text-muted">
                              {formatNumber(l.quantity, 1)} {l.unit} · P {formatNumber(l.protein_g, 1)} · C{" "}
                              {formatNumber(l.carbs_g, 1)} · F {formatNumber(l.fat_g, 1)}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums">{formatNumber(l.calories)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 pb-3 text-sm text-muted">Nothing logged</p>
                )}
              </Card>
            );
          })}

          <MicroSummary totals={data.totals} targets={data.targets} />
        </div>
      )}

      {adding ? <AddFoodSheet open onClose={() => setAdding(null)} date={date} defaultMeal={adding} /> : null}
      {editing ? <EditFoodSheet log={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

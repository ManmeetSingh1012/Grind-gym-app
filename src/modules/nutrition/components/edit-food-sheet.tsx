"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { relativeTime } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";
import { useDeleteFood, useUpdateFood } from "../hooks";
import { MEALS, type FoodLog, type MealType } from "../schemas";
import { scaleFood } from "./add-food-sheet";

/** Edit a logged food. Changing the quantity rescales every nutrient proportionally. */
export function EditFoodSheet({ log, onClose }: { log: FoodLog; onClose: () => void }) {
  const [name, setName] = useState(log.name);
  const [quantity, setQuantity] = useState(String(log.quantity));
  const [meal, setMeal] = useState<MealType>(log.meal);
  const update = useUpdateFood();
  const remove = useDeleteFood();
  const scaled = scaleFood(log, Number(quantity) || log.quantity);

  return (
    <Sheet open onClose={onClose} title="Edit food">
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity (${log.unit})`}>
            <Input type="number" step="any" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Meal">
            <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} className="capitalize">
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-sm tabular-nums text-muted">
          {formatNumber(scaled.calories)} kcal · P {scaled.protein_g} g · C {scaled.carbs_g} g · F {scaled.fat_g} g
        </p>
        <p className="text-xs text-muted">Last updated {relativeTime(log.updated_at)} · source: {log.source}</p>
        <div className="mt-2 flex gap-2">
          <Button
            variant="danger"
            size="icon"
            className="h-11 w-11"
            aria-label="Delete"
            loading={remove.isPending}
            onClick={() => remove.mutate(log.id, { onSuccess: onClose })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            className="flex-1"
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                {
                  id: log.id,
                  name,
                  meal,
                  quantity: scaled.quantity,
                  calories: scaled.calories,
                  protein_g: scaled.protein_g,
                  carbs_g: scaled.carbs_g,
                  fat_g: scaled.fat_g,
                  micros: scaled.micros,
                },
                { onSuccess: onClose },
              )
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

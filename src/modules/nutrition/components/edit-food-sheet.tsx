"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { relativeTime } from "@/lib/dates";
import { useDeleteFood, useUpdateFood } from "../hooks";
import { scaleMicros } from "../nutrients";
import { MEALS, type FoodLog, type MealType } from "../schemas";
import { scaleFood } from "./add-food-sheet";

type Macros = { calories: string; protein_g: string; carbs_g: string; fat_g: string };

const toStrings = (f: Pick<FoodLog, "calories" | "protein_g" | "carbs_g" | "fat_g">): Macros => ({
  calories: String(f.calories),
  protein_g: String(f.protein_g),
  carbs_g: String(f.carbs_g),
  fat_g: String(f.fat_g),
});

const MACRO_FIELDS: { key: keyof Macros; label: string }[] = [
  { key: "calories", label: "Calories (kcal)" },
  { key: "protein_g", label: "Protein (g)" },
  { key: "carbs_g", label: "Carbs (g)" },
  { key: "fat_g", label: "Fat (g)" },
];

/**
 * Edit a logged food. Changing the quantity rescales every nutrient proportionally;
 * calories and macros can also be typed directly to correct a bad estimate.
 */
export function EditFoodSheet({ log, onClose }: { log: FoodLog; onClose: () => void }) {
  const [name, setName] = useState(log.name);
  const [quantity, setQuantity] = useState(String(log.quantity));
  const [meal, setMeal] = useState<MealType>(log.meal);
  const [macros, setMacros] = useState<Macros>(toStrings(log));
  const update = useUpdateFood();
  const remove = useDeleteFood();

  function changeQuantity(v: string) {
    setQuantity(v);
    const q = Number(v);
    if (q > 0) setMacros(toStrings(scaleFood(log, q)));
  }

  const num = (v: string) => Math.max(0, Number(v) || 0);
  const q = Number(quantity) || log.quantity;

  function save() {
    const calories = num(macros.calories);
    // Micros follow the calorie change (covers both a quantity change and a hand-corrected number).
    const microFactor = log.calories ? calories / log.calories : q / (log.quantity || 1);
    update.mutate(
      {
        id: log.id,
        name,
        meal,
        quantity: q,
        calories,
        protein_g: num(macros.protein_g),
        carbs_g: num(macros.carbs_g),
        fat_g: num(macros.fat_g),
        micros: scaleMicros(log.micros ?? {}, microFactor),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Sheet open onClose={onClose} title="Edit food">
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity (${log.unit})`}>
            <Input type="number" step="any" inputMode="decimal" value={quantity} onChange={(e) => changeQuantity(e.target.value)} />
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

        <div className="rounded-2xl bg-surface-2/60 p-3">
          <p className="mb-2 text-xs text-muted">Tap a number to correct it. Changing quantity rescales them.</p>
          <div className="grid grid-cols-2 gap-3">
            {MACRO_FIELDS.map(({ key, label }) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  inputMode="decimal"
                  value={macros[key]}
                  onChange={(e) => setMacros({ ...macros, [key]: e.target.value })}
                  className={key === "calories" ? "font-semibold text-accent" : undefined}
                />
              </Field>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted">
          Last updated {relativeTime(log.updated_at)} · source: {log.source}
        </p>
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
          <Button className="flex-1" loading={update.isPending} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

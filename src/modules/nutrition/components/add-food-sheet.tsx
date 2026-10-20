"use client";

import { Check, Database, PenLine, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { Field, Input, Select, numberOrNull } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { VoiceInput } from "@/components/voice-input";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn, formatNumber } from "@/lib/utils";
import { useAddFoods, useFoodSearch, useParseMeal } from "../hooks";
import { round, scaleMicros } from "../nutrients";
import { MEALS, type CreateFoodLogInput, type FoodCandidate, type MealType } from "../schemas";

type Tab = "ai" | "search" | "manual";

export function scaleFood<T extends Pick<FoodCandidate, "quantity" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "micros">>(
  food: T,
  quantity: number,
): T {
  const f = food.quantity ? quantity / food.quantity : 1;
  return {
    ...food,
    quantity,
    calories: round(food.calories * f, 0),
    protein_g: round(food.protein_g * f, 1),
    carbs_g: round(food.carbs_g * f, 1),
    fat_g: round(food.fat_g * f, 1),
    micros: scaleMicros(food.micros ?? {}, f),
  };
}

export function AddFoodSheet({
  open,
  onClose,
  date,
  defaultMeal,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  defaultMeal: MealType;
}) {
  const [tab, setTab] = useState<Tab>("ai");
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const add = useAddFoods();

  function log(items: Omit<CreateFoodLogInput, "eaten_on" | "meal">[], mealOverride?: MealType) {
    add.mutate(
      items.map((i) => ({ ...i, eaten_on: date, meal: mealOverride ?? meal })),
      {
        onSuccess: () => {
          toast.success(items.length === 1 ? `${items[0].name} logged` : `${items.length} foods logged`);
          onClose();
        },
      },
    );
  }

  const tabs = [
    { id: "ai", label: "Describe", icon: Sparkles },
    { id: "search", label: "Search", icon: Database },
    { id: "manual", label: "Manual", icon: PenLine },
  ] as const;

  return (
    <Sheet open={open} onClose={onClose} title="Log food">
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium",
              tab === id ? "bg-surface text-foreground" : "text-muted",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <Field label="Meal" className="mb-4">
        <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} className="capitalize">
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </Field>

      {tab === "ai" ? <DescribeTab onLog={log} saving={add.isPending} /> : null}
      {tab === "search" ? <SearchTab onLog={log} saving={add.isPending} /> : null}
      {tab === "manual" ? <ManualTab onLog={log} saving={add.isPending} /> : null}
    </Sheet>
  );
}

type LogFn = (items: Omit<CreateFoodLogInput, "eaten_on" | "meal">[], meal?: MealType) => void;

function DescribeTab({ onLog, saving }: { onLog: LogFn; saving: boolean }) {
  const [text, setText] = useState("");
  const parse = useParseMeal();
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const items = parse.data?.items ?? [];
  const chosen = items.filter((_, i) => !excluded.has(i));

  return (
    <div className="flex flex-col gap-3">
      <VoiceInput
        value={text}
        onChange={setText}
        onSubmit={(v) => {
          setExcluded(new Set());
          parse.mutate(v);
        }}
        placeholder='e.g. "3 egg omelette, 2 toast and black coffee"'
      />
      {parse.isPending ? (
        <>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="h-4 w-4 animate-pulse text-accent" /> Calculating nutrition…
          </p>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </>
      ) : null}
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            const next = new Set(excluded);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            setExcluded(next);
          }}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3 text-left transition",
            excluded.has(i) ? "border-border opacity-50" : "border-accent/40 bg-accent/5",
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
              excluded.has(i) ? "border-border" : "border-accent bg-accent text-accent-foreground",
            )}
          >
            {excluded.has(i) ? null : <Check className="h-3.5 w-3.5" />}
          </span>
          <span className="flex-1">
            <span className="font-medium">{item.name}</span>
            <span className="block text-xs text-muted">
              {formatNumber(item.quantity, 1)} {item.unit} (~{formatNumber(item.grams_total)} g)
            </span>
            <span className="mt-1 block text-xs tabular-nums">
              {formatNumber(item.calories)} kcal · P {formatNumber(item.protein_g, 1)} · C {formatNumber(item.carbs_g, 1)} · F{" "}
              {formatNumber(item.fat_g, 1)}
            </span>
          </span>
        </button>
      ))}
      {chosen.length ? (
        <Button
          size="lg"
          loading={saving}
          onClick={() =>
            onLog(
              chosen.map(({ grams_total: _, ...item }) => ({ ...item, source: "ai" as const })),
              parse.data?.meal,
            )
          }
        >
          Log {chosen.length} item{chosen.length > 1 ? "s" : ""} · {formatNumber(chosen.reduce((s, i) => s + i.calories, 0))} kcal
        </Button>
      ) : null}
      {!items.length && !parse.isPending ? (
        <p className="py-4 text-center text-sm text-muted">
          Describe or speak your meal. AI estimates calories, macros and 24 micronutrients.
        </p>
      ) : null}
    </div>
  );
}

function SearchTab({ onLog, saving }: { onLog: LogFn; saving: boolean }) {
  const [text, setText] = useState("");
  const q = useDebouncedValue(text.trim(), 400);
  const search = useFoodSearch(q);
  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [grams, setGrams] = useState("100");

  if (selected) {
    const scaled = scaleFood(selected, Number(grams) || 0);
    return (
      <div className="flex flex-col gap-3">
        <p className="font-semibold">{selected.name}</p>
        <Field label="Amount (g)">
          <Input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </Field>
        <p className="text-sm tabular-nums text-muted">
          {formatNumber(scaled.calories)} kcal · P {scaled.protein_g} · C {scaled.carbs_g} · F {scaled.fat_g}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setSelected(null)}>
            Back
          </Button>
          <Button
            className="flex-1"
            loading={saving}
            disabled={!Number(grams)}
            onClick={() => {
              const { ref: _r, grams_per_unit: _g, ...item } = scaled;
              onLog([item]);
            }}
          >
            Log
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search USDA food database…" autoFocus />
      {search.isFetching ? <Skeleton className="h-14" /> : null}
      {search.error ? <p className="text-sm text-danger">{search.error.message}</p> : null}
      {(search.data ?? []).map((f) => (
        <button key={f.ref} onClick={() => setSelected(f)} className="rounded-xl px-3 py-2.5 text-left hover:bg-surface-2">
          <span className="line-clamp-1 font-medium">{f.name}</span>
          <span className="text-xs text-muted tabular-nums">
            per 100 g · {formatNumber(f.calories)} kcal · P {f.protein_g} · C {f.carbs_g} · F {f.fat_g}
          </span>
        </button>
      ))}
    </div>
  );
}

function ManualTab({ onLog, saving }: { onLog: LogFn; saving: boolean }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return toast.error("Give the food a name");
    onLog([
      {
        name,
        quantity: numberOrNull(f.get("quantity")) ?? 1,
        unit: String(f.get("unit") || "serving"),
        calories: numberOrNull(f.get("calories")) ?? 0,
        protein_g: numberOrNull(f.get("protein_g")) ?? 0,
        carbs_g: numberOrNull(f.get("carbs_g")) ?? 0,
        fat_g: numberOrNull(f.get("fat_g")) ?? 0,
        micros: {},
        source: "manual",
      },
    ]);
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="Name" className="col-span-2">
        <Input name="name" required />
      </Field>
      <Field label="Quantity">
        <Input name="quantity" type="number" step="any" inputMode="decimal" defaultValue={1} />
      </Field>
      <Field label="Unit">
        <Input name="unit" defaultValue="serving" />
      </Field>
      <Field label="Calories">
        <Input name="calories" type="number" step="any" inputMode="decimal" required />
      </Field>
      <Field label="Protein (g)">
        <Input name="protein_g" type="number" step="any" inputMode="decimal" />
      </Field>
      <Field label="Carbs (g)">
        <Input name="carbs_g" type="number" step="any" inputMode="decimal" />
      </Field>
      <Field label="Fat (g)">
        <Input name="fat_g" type="number" step="any" inputMode="decimal" />
      </Field>
      <Button type="submit" size="lg" className="col-span-2" loading={saving}>
        Log food
      </Button>
    </form>
  );
}

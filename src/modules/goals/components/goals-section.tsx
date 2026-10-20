"use client";

import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardTitle, Skeleton } from "@/components/ui/card";
import { Field, Input, Select, Textarea, numberOrNull } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { formatDate } from "@/lib/dates";
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from "../hooks";
import { GOAL_LABELS, goalType, type CreateGoalInput, type Goal } from "../schemas";

export function GoalsSection() {
  const { data: goals, isPending } = useGoals();
  const update = useUpdateGoal();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);

  return (
    <Card>
      <CardTitle
        action={
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Goal
          </Button>
        }
      >
        Goals
      </CardTitle>
      {isPending ? <Skeleton className="h-16" /> : null}
      {goals && !goals.length ? (
        <p className="text-sm text-muted">Set a goal so your targets, plan and coaching aim at it.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {goals?.map((g) => (
          <li key={g.id} className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
            <Target className={g.is_active ? "mt-0.5 h-4 w-4 text-accent" : "mt-0.5 h-4 w-4 text-muted"} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {g.title} {g.is_active ? <Badge className="ml-1 bg-accent/15 text-accent">Active</Badge> : null}
              </p>
              <p className="text-xs text-muted">
                {GOAL_LABELS[g.type]}
                {g.target_weight_kg ? ` · ${g.target_weight_kg} kg` : ""}
                {g.target_body_fat_pct ? ` · ${g.target_body_fat_pct}% BF` : ""}
                {g.target_date ? ` · by ${formatDate(g.target_date)}` : ""} · {g.training_days} days/week
              </p>
              {!g.is_active ? (
                <button
                  className="mt-1 text-xs text-accent"
                  onClick={() => update.mutate({ id: g.id, is_active: true })}
                >
                  Make active
                </button>
              ) : null}
            </div>
            <Button size="icon-sm" variant="ghost" aria-label="Edit goal" onClick={() => setEditing(g)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      {editing ? <GoalSheet goal={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function GoalSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const remove = useDeleteGoal();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input: CreateGoalInput = {
      type: goalType.parse(f.get("type")),
      title: String(f.get("title")),
      target_weight_kg: numberOrNull(f.get("target_weight_kg")),
      target_body_fat_pct: numberOrNull(f.get("target_body_fat_pct")),
      target_date: String(f.get("target_date") || "") || null,
      training_days: numberOrNull(f.get("training_days")) ?? 6,
      notes: String(f.get("notes") || "") || null,
      is_active: goal?.is_active ?? true,
    };
    if (goal) update.mutate({ id: goal.id, ...input }, { onSuccess: onClose });
    else create.mutate(input, { onSuccess: onClose });
  }

  return (
    <Sheet open onClose={onClose} title={goal ? "Edit goal" : "New goal"}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Goal type" className="col-span-2">
          <Select name="type" defaultValue={goal?.type ?? "recomp"}>
            {goalType.options.map((t) => (
              <option key={t} value={t}>
                {GOAL_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" className="col-span-2">
          <Input name="title" defaultValue={goal?.title ?? ""} placeholder="e.g. Shredded by summer" required minLength={2} />
        </Field>
        <Field label="Target weight (kg)">
          <Input name="target_weight_kg" type="number" step="0.1" inputMode="decimal" defaultValue={goal?.target_weight_kg ?? ""} />
        </Field>
        <Field label="Target body fat %">
          <Input name="target_body_fat_pct" type="number" step="0.1" inputMode="decimal" defaultValue={goal?.target_body_fat_pct ?? ""} />
        </Field>
        <Field label="Target date">
          <Input name="target_date" type="date" defaultValue={goal?.target_date ?? ""} />
        </Field>
        <Field label="Training days / week">
          <Input name="training_days" type="number" min={1} max={7} defaultValue={goal?.training_days ?? 6} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <Textarea name="notes" defaultValue={goal?.notes ?? ""} placeholder="Why this goal, constraints, preferences…" />
        </Field>
        {goal ? (
          <Button
            type="button"
            variant="danger"
            loading={remove.isPending}
            onClick={() => confirm("Delete this goal?") && remove.mutate(goal.id, { onSuccess: onClose })}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        ) : null}
        <Button type="submit" className={goal ? "" : "col-span-2"} loading={create.isPending || update.isPending}>
          Save goal
        </Button>
      </form>
    </Sheet>
  );
}

"use client";

import { Check, Loader2, Mic, Pencil, Plus, Square, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate, relativeTime } from "@/lib/dates";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { cn, formatNumber } from "@/lib/utils";
import { useDeleteSet, useLogSet, useLogSets, useUpdateSet } from "../hooks";
import type { SetLog, WeightRecord } from "../schemas";
import { parseSpokenSets } from "../voice";

function NumberBox({
  value,
  onChange,
  label,
  step,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  step: number;
}) {
  return (
    <label className="flex flex-1 flex-col">
      <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <input
        inputMode="decimal"
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-surface-2 text-center text-lg font-semibold tabular-nums outline-none focus:border-accent/60"
      />
    </label>
  );
}

/** One logged set: tap the pencil to edit weight/reps inline, or delete it. */
export function SetRow({ set }: { set: SetLog }) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(String(set.weight_kg));
  const [reps, setReps] = useState(String(set.reps));
  const update = useUpdateSet();
  const remove = useDeleteSet();

  if (editing) {
    return (
      <div className="flex items-end gap-2 py-1.5">
        <span className="w-6 pb-3 text-sm text-muted">{set.set_number}</span>
        <NumberBox label="kg" value={weight} onChange={setWeight} step={0.5} />
        <NumberBox label="reps" value={reps} onChange={setReps} step={1} />
        <Button
          size="icon"
          aria-label="Save set"
          loading={update.isPending}
          onClick={() =>
            update.mutate(
              { id: set.id, weight_kg: Number(weight), reps: Math.round(Number(reps)) },
              { onSuccess: () => setEditing(false) },
            )
          }
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Cancel" onClick={() => setEditing(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-6 text-sm text-muted">{set.set_number}</span>
      <span className="flex-1 font-semibold tabular-nums">
        {formatNumber(set.weight_kg, 2)} kg <span className="text-muted">×</span> {set.reps}
      </span>
      <span className="text-xs text-muted">{relativeTime(set.updated_at)}</span>
      <Button size="icon-sm" variant="ghost" aria-label="Edit set" onClick={() => setEditing(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Delete set"
        loading={remove.isPending}
        onClick={() => remove.mutate(set.id)}
        className="hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/**
 * Input row for the next set. Prefills from the previous set and shows when
 * the typed weight was last lifted, so you can see what to beat.
 */
export function AddSetRow({
  exerciseId,
  date,
  suggestion,
  byWeight,
}: {
  exerciseId: string;
  date: string;
  suggestion?: { weight_kg: number; reps: number };
  byWeight: WeightRecord[];
}) {
  const [weight, setWeight] = useState(suggestion ? String(suggestion.weight_kg) : "");
  const [reps, setReps] = useState(suggestion ? String(suggestion.reps) : "");
  const log = useLogSet();
  const logMany = useLogSets();

  /** Spoken set: "80 kg 8 reps", "3 sets of 10 at 60", or just "10" (uses the weight in the box). */
  const speech = useSpeechRecognition({
    onFinal: (heard) => {
      const parsed = parseSpokenSets(heard, weight === "" ? undefined : Number(weight));
      if (!parsed) {
        toast.error(`Heard "${heard}". Try "80 kg 8 reps" or "3 sets of 10 at 60".`);
        return;
      }
      setWeight(String(parsed.weight_kg));
      setReps(String(parsed.reps));
      logMany.mutate(
        Array.from({ length: parsed.sets }, () => ({
          exercise_id: exerciseId,
          performed_on: date,
          weight_kg: parsed.weight_kg,
          reps: parsed.reps,
        })),
        {
          onSuccess: () =>
            toast.success(
              `Logged ${parsed.sets > 1 ? `${parsed.sets} × ` : ""}${formatNumber(parsed.weight_kg, 2)} kg × ${parsed.reps}`,
            ),
        },
      );
    },
  });

  const w = Number(weight);
  const record = weight !== "" ? byWeight.find((r) => r.weight_kg === w) : undefined;
  const heavier = weight !== "" && byWeight.length > 0 && w > byWeight[0].weight_kg;

  return (
    <div className="mt-2 rounded-xl bg-surface-2/50 p-2">
      <div className="flex items-end gap-2">
        <NumberBox label="kg" value={weight} onChange={setWeight} step={0.5} />
        <NumberBox label="reps" value={reps} onChange={setReps} step={1} />
        {speech.supported ? (
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            aria-label={speech.listening ? "Stop listening" : "Say your set"}
            disabled={logMany.isPending}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50",
              speech.listening ? "animate-pulse-ring bg-danger text-white" : "bg-surface-2 text-foreground hover:bg-border",
            )}
          >
            {logMany.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : speech.listening ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        ) : null}
        <Button
          size="icon"
          aria-label="Add set"
          className="h-11 w-14"
          loading={log.isPending}
          disabled={reps === ""}
          onClick={() =>
            log.mutate({
              exercise_id: exerciseId,
              performed_on: date,
              weight_kg: w || 0,
              reps: Math.round(Number(reps)),
            })
          }
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <p className={cn("mt-1.5 px-1 text-xs", heavier || speech.listening ? "text-accent" : "text-muted")}>
        {speech.listening
          ? speech.interim || 'Listening… say "80 kg 8 reps" or "3 sets of 10 at 60"'
          : speech.error
            ? speech.error
            : heavier
          ? "New heaviest weight for this exercise 🔥"
          : record
            ? `Last time at ${formatNumber(w, 2)} kg: ${formatDate(record.lastDate)} · best ${record.bestReps} reps`
            : weight !== "" && byWeight.length
              ? `Never logged ${formatNumber(w, 2)} kg on this exercise`
              : " "}
      </p>
    </div>
  );
}

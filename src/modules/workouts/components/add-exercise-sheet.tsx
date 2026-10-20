"use client";

import { ExternalLink, Globe, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { VoiceInput } from "@/components/voice-input";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { Exercise, ExerciseLookupResult } from "@/modules/exercises/schemas";
import { useAddExerciseToDay, useExerciseLookup, useExerciseSearch } from "../hooks";

type Candidate = ExerciseLookupResult["candidates"][number];

export function AddExerciseSheet({
  open,
  onClose,
  weekday,
  weekdayLabel,
  date,
  existingIds,
}: {
  open: boolean;
  onClose: () => void;
  weekday: number;
  weekdayLabel: string;
  date: string;
  existingIds: string[];
}) {
  const [text, setText] = useState("");
  const q = useDebouncedValue(text.trim(), 250);
  const search = useExerciseSearch(q);
  const lookup = useExerciseLookup();
  const add = useAddExerciseToDay();

  const local = (search.data ?? []).filter((e) => !existingIds.includes(e.id));
  const ai = lookup.data;

  function close() {
    setText("");
    lookup.reset();
    onClose();
  }

  /** Typed Enter or finished speaking: if nothing matches exactly, ask the AI (which can search the web). */
  function submit(value: string) {
    const exact = (search.data ?? []).find((e) => e.name.toLowerCase() === value.toLowerCase());
    if (exact) return addExercise({ id: exact.id }, exact.name);
    lookup.mutate(value);
  }

  function addExercise(exercise: { id: string } | Candidate, name: string, sets?: ExerciseLookupResult["detected_sets"]) {
    add.mutate(
      {
        weekday,
        date,
        exercise:
          "id" in exercise
            ? exercise
            : {
                name: exercise.name,
                muscle_group: exercise.muscle_group.toLowerCase(),
                secondary_muscles: exercise.secondary_muscles.map((m) => m.toLowerCase()),
                equipment: exercise.equipment,
                category: exercise.category,
                instructions: exercise.instructions,
                source_url: exercise.source_url?.startsWith("http") ? exercise.source_url : null,
              },
        sets,
      },
      {
        onSuccess: () => {
          toast.success(sets?.length ? `${name} added with ${sets.length} sets` : `${name} added to ${weekdayLabel}`);
          close();
        },
      },
    );
  }

  return (
    <Sheet open={open} onClose={close} title={`Add to ${weekdayLabel}`}>
      <VoiceInput
        value={text}
        onChange={setText}
        onSubmit={submit}
        autoFocus
        placeholder='Type or say e.g. "incline press 3×10 at 30"'
      />

      <div className="mt-4 flex flex-col gap-2">
        {lookup.isPending ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Sparkles className="h-4 w-4 animate-pulse text-accent" /> Identifying exercise…
            </p>
            <Skeleton className="h-20" />
          </div>
        ) : null}

        {ai ? (
          <section className="flex flex-col gap-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
              <Sparkles className="h-3.5 w-3.5" /> AI matches
            </h4>
            {ai.detected_sets.length ? (
              <p className="text-xs text-muted">
                Will also log: {ai.detected_sets.map((s) => `${s.weight_kg}kg×${s.reps}`).join(", ")}
              </p>
            ) : null}
            {ai.candidates.length === 0 ? <p className="text-sm text-muted">No exercise found. Try another name.</p> : null}
            {ai.candidates.map((c) => (
              <CandidateRow
                key={c.name}
                candidate={c}
                loading={add.isPending && add.variables?.exercise && "name" in add.variables.exercise && add.variables.exercise.name === c.name}
                onAdd={() => addExercise(c, c.name, ai.detected_sets)}
              />
            ))}
          </section>
        ) : null}

        {q && local.length ? (
          <section className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Library</h4>
            {local.map((e) => (
              <LibraryRow key={e.id} exercise={e} onAdd={() => addExercise({ id: e.id }, e.name)} />
            ))}
          </section>
        ) : null}

        {q.length >= 2 && !lookup.isPending && !ai ? (
          <Button variant="outline" onClick={() => lookup.mutate(q)} className="mt-1">
            <Globe className="h-4 w-4" /> Find &ldquo;{q}&rdquo; with AI + web search
          </Button>
        ) : null}

        {!q ? (
          <p className="py-6 text-center text-sm text-muted">
            Search the library, or tap the mic and say what you did.
            <br />
            Unknown exercises are looked up on the internet.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function LibraryRow({ exercise, onAdd }: { exercise: Exercise; onAdd: () => void }) {
  return (
    <button onClick={onAdd} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-surface-2">
      <span>
        <span className="font-medium">{exercise.name}</span>
        <span className="block text-xs text-muted capitalize">
          {exercise.muscle_group}
          {exercise.equipment ? ` · ${exercise.equipment}` : ""}
        </span>
      </span>
      <Plus className="h-5 w-5 text-accent" />
    </button>
  );
}

function CandidateRow({ candidate, onAdd, loading }: { candidate: Candidate; onAdd: () => void; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{candidate.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge className="capitalize">{candidate.muscle_group}</Badge>
            <Badge className="capitalize">{candidate.equipment}</Badge>
          </div>
        </div>
        <Button size="sm" onClick={onAdd} loading={loading}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">{candidate.instructions}</p>
      {candidate.source_url?.startsWith("http") ? (
        <a
          href={candidate.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-accent"
        >
          Source <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

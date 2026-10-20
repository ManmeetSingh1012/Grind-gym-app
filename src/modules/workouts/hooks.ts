"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { CreateExerciseInput, Exercise, ExerciseLookupResult } from "@/modules/exercises/schemas";
import type { CreateSetInput, ExerciseHistory, RoutineItem, SetLog, UpdateRoutineInput, UpdateSetInput } from "./schemas";

export const workoutKeys = {
  all: ["workouts"] as const,
  routine: (weekday: number, date: string) => ["workouts", "routine", weekday, date] as const,
  history: (exerciseId: string) => ["workouts", "history", exerciseId] as const,
  search: (q: string) => ["exercises", "search", q] as const,
};

export function useRoutine(weekday: number, date: string) {
  return useQuery({
    queryKey: workoutKeys.routine(weekday, date),
    queryFn: () => api.get<RoutineItem[]>(`/routine?weekday=${weekday}&date=${date}`),
  });
}

export function useExerciseHistory(exerciseId: string) {
  return useQuery({
    queryKey: workoutKeys.history(exerciseId),
    queryFn: () => api.get<ExerciseHistory>(`/exercises/${exerciseId}/history`),
  });
}

export function useExerciseSearch(q: string) {
  return useQuery({
    queryKey: workoutKeys.search(q),
    queryFn: () => api.get<Exercise[]>(`/exercises?q=${encodeURIComponent(q)}`),
    staleTime: 5 * 60_000,
  });
}

export function useExerciseLookup() {
  return useMutation({
    mutationFn: (query: string) => api.post<ExerciseLookupResult>("/exercises/lookup", { query }),
  });
}

/** Invalidates everything workout-related; cheap and keeps "last time" stats consistent. */
function useInvalidateWorkouts() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: workoutKeys.all });
}

/**
 * Adds an exercise to a weekday. Accepts an existing exercise id or a new
 * exercise definition (from AI lookup), and optionally logs sets right away.
 */
export function useAddExerciseToDay() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({
    mutationFn: async (input: {
      weekday: number;
      date: string;
      exercise: { id: string } | CreateExerciseInput;
      sets?: { weight_kg: number; reps: number }[];
    }) => {
      const exerciseId =
        "id" in input.exercise ? input.exercise.id : (await api.post<Exercise>("/exercises", input.exercise)).id;
      await api.post("/routine", { weekday: input.weekday, exercise_id: exerciseId }).catch((err) => {
        // Already on this day is fine: we still want to log the sets.
        if (err.status !== 409) throw err;
      });
      if (input.sets?.length) {
        await api.post("/sets", {
          sets: input.sets.map((s) => ({ ...s, exercise_id: exerciseId, performed_on: input.date })),
        });
      }
      return exerciseId;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateRoutineItem() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateRoutineInput & { id: string }) => api.patch(`/routine/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useRemoveRoutineItem() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({ mutationFn: (id: string) => api.delete(`/routine/${id}`), onSuccess: invalidate });
}

export function useLogSet() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({
    mutationFn: (set: CreateSetInput) => api.post<SetLog[]>("/sets", { sets: [set] }),
    onSuccess: invalidate,
  });
}

export function useUpdateSet() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateSetInput & { id: string }) => api.patch<SetLog>(`/sets/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSet() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({ mutationFn: (id: string) => api.delete(`/sets/${id}`), onSuccess: invalidate });
}

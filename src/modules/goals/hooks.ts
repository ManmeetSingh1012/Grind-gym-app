"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { CreateGoalInput, Goal, UpdateGoalInput } from "./schemas";

export const goalsKey = ["goals"] as const;

export function useGoals() {
  return useQuery({ queryKey: goalsKey, queryFn: () => api.get<Goal[]>("/goals") });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: goalsKey });
    // Calculated nutrition targets depend on the active goal.
    qc.invalidateQueries({ queryKey: ["nutrition"] });
  };
}

export function useCreateGoal() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: CreateGoalInput) => api.post<Goal>("/goals", input), onSuccess: invalidate });
}

export function useUpdateGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateGoalInput & { id: string }) => api.patch<Goal>(`/goals/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.delete(`/goals/${id}`), onSuccess: invalidate });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  CreateFoodLogInput,
  DaySummary,
  FoodCandidate,
  FoodLog,
  NutritionTargets,
  ParsedMeal,
} from "./schemas";

export const nutritionKeys = {
  all: ["nutrition"] as const,
  day: (date: string) => ["nutrition", "day", date] as const,
  targets: ["nutrition", "targets"] as const,
  search: (q: string) => ["foods", "search", q] as const,
};

export function useDaySummary(date: string) {
  return useQuery({ queryKey: nutritionKeys.day(date), queryFn: () => api.get<DaySummary>(`/nutrition/summary?date=${date}`) });
}

export function useFoodSearch(q: string) {
  return useQuery({
    queryKey: nutritionKeys.search(q),
    queryFn: () => api.get<FoodCandidate[]>(`/nutrition/foods/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 60 * 60_000,
  });
}

export function useParseMeal() {
  return useMutation({ mutationFn: (text: string) => api.post<ParsedMeal>("/nutrition/parse", { text }) });
}

function useInvalidateNutrition() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: nutritionKeys.all });
}

export function useAddFoods() {
  const invalidate = useInvalidateNutrition();
  return useMutation({
    mutationFn: (items: CreateFoodLogInput[]) => api.post<FoodLog[]>("/nutrition/logs", { items }),
    onSuccess: invalidate,
  });
}

export function useUpdateFood() {
  const invalidate = useInvalidateNutrition();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateFoodLogInput> & { id: string }) => api.patch<FoodLog>(`/nutrition/logs/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteFood() {
  const invalidate = useInvalidateNutrition();
  return useMutation({ mutationFn: (id: string) => api.delete(`/nutrition/logs/${id}`), onSuccess: invalidate });
}

export function useSaveTargets() {
  const invalidate = useInvalidateNutrition();
  return useMutation({
    mutationFn: (input: Partial<Omit<NutritionTargets, "source">>) => api.put<NutritionTargets>("/nutrition/targets", input),
    onSuccess: invalidate,
  });
}

export function useResetTargets() {
  const invalidate = useInvalidateNutrition();
  return useMutation({ mutationFn: () => api.delete<NutritionTargets>("/nutrition/targets"), onSuccess: invalidate });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { BodyScan, PlanReport, UpdateScanInput } from "./schemas";

export const bodyKeys = {
  scans: ["body", "scans"] as const,
  plan: ["body", "plan"] as const,
};

export function useScans() {
  return useQuery({ queryKey: bodyKeys.scans, queryFn: () => api.get<BodyScan[]>("/body-scans") });
}

export function useUploadScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.set("file", file);
      return api.post<BodyScan>("/body-scans", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bodyKeys.scans });
      qc.invalidateQueries({ queryKey: ["nutrition"] });
    },
  });
}

export function useUpdateScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateScanInput & { id: string }) => api.patch<BodyScan>(`/body-scans/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: bodyKeys.scans }),
  });
}

export function useDeleteScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/body-scans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: bodyKeys.scans }),
  });
}

export function usePlan() {
  return useQuery({ queryKey: bodyKeys.plan, queryFn: () => api.get<PlanReport | null>("/plans") });
}

export function useGeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { scan_id?: string; notes?: string }) => api.post<PlanReport>("/plans", input),
    onSuccess: (plan) => qc.setQueryData(bodyKeys.plan, plan),
  });
}

export function useApplyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; nutrition: boolean; training: boolean }) => api.post(`/plans/${id}/apply`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      qc.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

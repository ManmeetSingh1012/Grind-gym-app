"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Skeleton } from "@/components/ui/card";
import { Field, Input, Select, numberOrNull } from "@/components/ui/field";
import { api } from "@/lib/api/client";
import { ACTIVITY_LABELS, activityLevel, type Profile, type UpdateProfileInput } from "../schemas";

export const profileKey = ["profile"] as const;

export function useProfile() {
  return useQuery({ queryKey: profileKey, queryFn: () => api.get<Profile>("/profile") });
}

export function ProfileForm() {
  const qc = useQueryClient();
  const { data: profile, isPending } = useProfile();
  const save = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<Profile>("/profile", input),
    onSuccess: (p) => {
      qc.setQueryData(profileKey, p);
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      toast.success("Profile saved");
    },
  });

  if (isPending || !profile) return <Skeleton className="h-72" />;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      display_name: String(f.get("display_name") || "") || null,
      sex: (f.get("sex") || null) as Profile["sex"],
      birth_date: String(f.get("birth_date") || "") || null,
      height_cm: numberOrNull(f.get("height_cm")),
      weight_kg: numberOrNull(f.get("weight_kg")),
      activity_level: activityLevel.parse(f.get("activity_level")),
    });
  }

  return (
    <Card>
      <CardTitle>About you</CardTitle>
      <p className="-mt-1 mb-3 text-xs text-muted">Used to personalise calories, macros and micronutrient targets.</p>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2">
          <Input name="display_name" defaultValue={profile.display_name ?? ""} />
        </Field>
        <Field label="Sex">
          <Select name="sex" defaultValue={profile.sex ?? ""}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
        </Field>
        <Field label="Birth date">
          <Input name="birth_date" type="date" defaultValue={profile.birth_date ?? ""} />
        </Field>
        <Field label="Height (cm)">
          <Input name="height_cm" type="number" step="0.1" inputMode="decimal" defaultValue={profile.height_cm ?? ""} />
        </Field>
        <Field label="Weight (kg)">
          <Input name="weight_kg" type="number" step="0.1" inputMode="decimal" defaultValue={profile.weight_kg ?? ""} />
        </Field>
        <Field label="Activity" className="col-span-2">
          <Select name="activity_level" defaultValue={profile.activity_level}>
            {activityLevel.options.map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABELS[a]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" className="col-span-2" loading={save.isPending}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}

"use client";

import { Camera, Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, Skeleton } from "@/components/ui/card";
import { Field, Input, numberOrNull } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { formatDate } from "@/lib/dates";
import { cn, formatNumber } from "@/lib/utils";
import { useDeleteScan, useScans, useUpdateScan, useUploadScan } from "../hooks";
import type { BodyScan } from "../schemas";

const METRICS = [
  { key: "weight_kg", label: "Weight", unit: "kg", lowerIsBetter: null },
  { key: "body_fat_pct", label: "Body fat", unit: "%", lowerIsBetter: true },
  { key: "skeletal_muscle_kg", label: "Muscle", unit: "kg", lowerIsBetter: false },
  { key: "fat_mass_kg", label: "Fat mass", unit: "kg", lowerIsBetter: true },
  { key: "visceral_fat_level", label: "Visceral", unit: "", lowerIsBetter: true },
  { key: "bmr_kcal", label: "BMR", unit: "kcal", lowerIsBetter: null },
] as const;

export function ScansSection() {
  const { data: scans, isPending } = useScans();
  const upload = useUploadScan();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<BodyScan | null>(null);

  const [latest, previous] = scans ?? [];

  return (
    <section className="flex flex-col gap-3">
      <Card className="border-accent/30 bg-gradient-to-br from-accent/10 to-transparent">
        <p className="font-semibold">Upload body composition test</p>
        <p className="mt-1 text-sm text-muted">
          Photo or screenshot of your InBody / scale report. AI reads every value and uses it for your plan.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload.mutate(file, { onSuccess: () => toast.success("Scan analysed") });
          }}
        />
        <Button className="mt-3 w-full" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
          <Camera className="h-4 w-4" /> {upload.isPending ? "Reading your report…" : "Upload report"}
        </Button>
      </Card>

      {isPending ? <Skeleton className="h-40" /> : null}
      {scans && !scans.length ? <EmptyState title="No scans yet">Your results and trends will show here.</EmptyState> : null}

      {latest ? (
        <Card>
          <CardTitle
            action={
              <Button variant="ghost" size="icon-sm" aria-label="Edit values" onClick={() => setEditing(latest)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
          >
            Latest · {formatDate(latest.scanned_on)}
          </CardTitle>
          <div className="grid grid-cols-3 gap-2">
            {METRICS.map((m) => {
              const v = latest[m.key];
              const p = previous?.[m.key];
              const delta = v != null && p != null ? v - p : null;
              const good = delta == null || m.lowerIsBetter == null ? null : m.lowerIsBetter ? delta < 0 : delta > 0;
              return (
                <div key={m.key} className="rounded-xl bg-surface-2 p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{m.label}</p>
                  <p className="text-lg font-bold tabular-nums">
                    {v != null ? formatNumber(v, 1) : "—"}
                    <span className="text-xs font-normal text-muted"> {m.unit}</span>
                  </p>
                  {delta ? (
                    <p
                      className={cn(
                        "flex items-center gap-0.5 text-xs tabular-nums",
                        good == null ? "text-muted" : good ? "text-success" : "text-danger",
                      )}
                    >
                      {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {delta > 0 ? "+" : ""}
                      {formatNumber(delta, 1)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {latest.metrics.other?.length ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted">All {latest.metrics.other.length} extracted values</summary>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {latest.metrics.other.map((o, i) => (
                  <div key={i} className="flex justify-between gap-2 border-b border-border/50 py-1">
                    <dt className="text-muted">{o.label}</dt>
                    <dd className="tabular-nums">
                      {o.value} {o.unit}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </Card>
      ) : null}

      {scans && scans.length > 1 ? (
        <Card>
          <CardTitle>History</CardTitle>
          <ul className="divide-y divide-border/60 text-sm">
            {scans.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                {s.image_url ? (
                  <a href={s.image_url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
                    <img src={s.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  </a>
                ) : null}
                <span className="flex-1">{formatDate(s.scanned_on)}</span>
                <span className="tabular-nums text-muted">
                  {s.weight_kg ?? "—"} kg · {s.body_fat_pct ?? "—"}%
                </span>
                <button onClick={() => setEditing(s)} className="p-1 text-muted" aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {editing ? <EditScanSheet scan={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function EditScanSheet({ scan, onClose }: { scan: BodyScan; onClose: () => void }) {
  const update = useUpdateScan();
  const remove = useDeleteScan();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    update.mutate(
      {
        id: scan.id,
        scanned_on: String(f.get("scanned_on")),
        weight_kg: numberOrNull(f.get("weight_kg")),
        body_fat_pct: numberOrNull(f.get("body_fat_pct")),
        skeletal_muscle_kg: numberOrNull(f.get("skeletal_muscle_kg")),
        fat_mass_kg: numberOrNull(f.get("fat_mass_kg")),
        visceral_fat_level: numberOrNull(f.get("visceral_fat_level")),
        bmr_kcal: numberOrNull(f.get("bmr_kcal")),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Sheet open onClose={onClose} title="Edit scan values">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Date" className="col-span-2">
          <Input name="scanned_on" type="date" defaultValue={scan.scanned_on} required />
        </Field>
        {METRICS.map((m) => (
          <Field key={m.key} label={`${m.label}${m.unit ? ` (${m.unit})` : ""}`}>
            <Input name={m.key} type="number" step="any" inputMode="decimal" defaultValue={scan[m.key] ?? ""} />
          </Field>
        ))}
        <Button
          type="button"
          variant="danger"
          loading={remove.isPending}
          onClick={() => confirm("Delete this scan?") && remove.mutate(scan.id, { onSuccess: onClose })}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
        <Button type="submit" loading={update.isPending}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}

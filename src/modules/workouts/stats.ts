import type { ExerciseStats, SetLog, WeightRecord } from "./schemas";

/** Epley estimate; only meaningful for sets of 1-12 reps. */
export function oneRepMax(weight: number, reps: number) {
  if (reps <= 0 || weight <= 0) return 0;
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function groupByDate(sets: SetLog[]) {
  const map = new Map<string, SetLog[]>();
  for (const s of sets) {
    const list = map.get(s.performed_on) ?? [];
    list.push(s);
    map.set(s.performed_on, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({
      date,
      sets: list.sort((a, b) => a.set_number - b.set_number),
      volume: list.reduce((v, s) => v + s.weight_kg * s.reps, 0),
    }));
}

/** Stats across all sets of one exercise; `excludeDate` is skipped when picking "last session". */
export function computeStats(sets: SetLog[], excludeDate?: string): ExerciseStats {
  if (!sets.length) return { lastSession: null, lastUpdatedAt: null, best: null, estimatedOneRepMax: null };

  const previous = groupByDate(sets).find((s) => s.date !== excludeDate) ?? null;

  let best: ExerciseStats["best"] = null;
  let e1rm = 0;
  let lastUpdatedAt = sets[0].updated_at;
  for (const s of sets) {
    if (!best || s.weight_kg > best.weight_kg || (s.weight_kg === best.weight_kg && s.reps > best.reps)) {
      best = { weight_kg: s.weight_kg, reps: s.reps, date: s.performed_on };
    }
    if (s.reps <= 12) e1rm = Math.max(e1rm, oneRepMax(s.weight_kg, s.reps));
    if (s.updated_at > lastUpdatedAt) lastUpdatedAt = s.updated_at;
  }

  return {
    lastSession: previous ? { date: previous.date, sets: previous.sets } : null,
    lastUpdatedAt,
    best,
    estimatedOneRepMax: e1rm || null,
  };
}

export function recordsByWeight(sets: SetLog[]): WeightRecord[] {
  const map = new Map<number, WeightRecord>();
  for (const s of sets) {
    const r = map.get(s.weight_kg);
    if (!r) {
      map.set(s.weight_kg, {
        weight_kg: s.weight_kg,
        bestReps: s.reps,
        lastDate: s.performed_on,
        lastUpdatedAt: s.updated_at,
      });
      continue;
    }
    r.bestReps = Math.max(r.bestReps, s.reps);
    if (s.performed_on > r.lastDate) r.lastDate = s.performed_on;
    if (s.updated_at > r.lastUpdatedAt) r.lastUpdatedAt = s.updated_at;
  }
  return [...map.values()].sort((a, b) => b.weight_kg - a.weight_kg);
}

import { describe, expect, it } from "vitest";
import type { SetLog } from "./schemas";
import { computeStats, groupByDate, oneRepMax, recordsByWeight } from "./stats";

let n = 0;
const set = (performed_on: string, weight_kg: number, reps: number, set_number = 1, updated_at = `${performed_on}T10:00:00Z`): SetLog => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  exercise_id: "00000000-0000-4000-8000-000000000999",
  performed_on,
  set_number,
  weight_kg,
  reps,
  rpe: null,
  notes: null,
  created_at: updated_at,
  updated_at,
});

describe("oneRepMax", () => {
  it("uses Epley and returns the weight for singles", () => {
    expect(oneRepMax(100, 1)).toBe(100);
    expect(oneRepMax(100, 10)).toBeCloseTo(133.3, 1);
    expect(oneRepMax(0, 5)).toBe(0);
  });
});

describe("computeStats", () => {
  const sets = [
    set("2026-10-20", 82.5, 6, 1),
    set("2026-10-13", 80, 8, 1),
    set("2026-10-13", 80, 7, 2, "2026-10-19T08:00:00Z"),
    set("2026-10-06", 85, 3, 1),
  ];

  it("skips the viewed day when picking the last session", () => {
    const stats = computeStats(sets, "2026-10-20");
    expect(stats.lastSession?.date).toBe("2026-10-13");
    expect(stats.lastSession?.sets.map((s) => s.reps)).toEqual([8, 7]);
  });

  it("tracks heaviest set, e1RM and latest update", () => {
    const stats = computeStats(sets);
    expect(stats.best).toEqual({ weight_kg: 85, reps: 3, date: "2026-10-06" });
    expect(stats.estimatedOneRepMax).toBeCloseTo(101.3, 1);
    expect(stats.lastUpdatedAt).toBe("2026-10-20T10:00:00Z");
  });

  it("handles no history", () => {
    expect(computeStats([])).toEqual({ lastSession: null, lastUpdatedAt: null, best: null, estimatedOneRepMax: null });
  });
});

describe("recordsByWeight", () => {
  it("returns last date and best reps per weight, heaviest first", () => {
    const records = recordsByWeight([set("2026-10-01", 80, 6), set("2026-10-10", 80, 8), set("2026-10-05", 90, 2)]);
    expect(records.map((r) => r.weight_kg)).toEqual([90, 80]);
    expect(records[1]).toMatchObject({ bestReps: 8, lastDate: "2026-10-10" });
  });
});

describe("groupByDate", () => {
  it("groups newest first with ordered sets and volume", () => {
    const groups = groupByDate([set("2026-10-01", 50, 10, 2), set("2026-10-02", 60, 5), set("2026-10-01", 50, 12, 1)]);
    expect(groups.map((g) => g.date)).toEqual(["2026-10-02", "2026-10-01"]);
    expect(groups[1].sets.map((s) => s.set_number)).toEqual([1, 2]);
    expect(groups[1].volume).toBe(1100);
  });
});

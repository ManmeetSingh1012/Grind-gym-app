import { describe, expect, it } from "vitest";
import type { Profile } from "@/modules/profile/schemas";
import { calculateTargets } from "./targets";

const profile: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  display_name: null,
  sex: "male",
  birth_date: "1996-01-01",
  height_cm: 178,
  weight_kg: 80,
  activity_level: "moderate",
};

describe("calculateTargets", () => {
  it("shows the working: BMR x activity = maintenance, plus the goal adjustment", () => {
    const t = calculateTargets({ profile, goal: "lose_fat", pace: "moderate" });
    const c = t.calculation!;
    expect(c.bmr_source).toBe("formula");
    expect(c.maintenance).toBe(Math.round(c.bmr * 1.55));
    expect(c.adjustment).toBe(-550); // 0.5 kg/week
    expect(c.weekly_change_kg).toBe(-0.5);
    expect(t.calories).toBe(c.maintenance - 550);
  });

  it("scales the deficit or surplus with pace", () => {
    const cut = (pace: "slow" | "moderate" | "fast") => calculateTargets({ profile, goal: "lose_fat", pace }).calories;
    expect(cut("slow")).toBeGreaterThan(cut("moderate"));
    expect(cut("moderate")).toBeGreaterThan(cut("fast"));
    const bulk = calculateTargets({ profile, goal: "build_muscle", pace: "moderate" });
    expect(bulk.calculation!.adjustment).toBeGreaterThan(0);
    const maintain = calculateTargets({ profile, goal: "maintain", pace: "fast" });
    expect(maintain.calculation!.adjustment).toBe(0);
    expect(maintain.calculation!.pace).toBeNull();
  });

  it("keeps macros consistent with calories", () => {
    const t = calculateTargets({ profile, goal: "recomp" });
    const fromMacros = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
    expect(Math.abs(fromMacros - t.calories)).toBeLessThan(15);
    expect(t.protein_g).toBe(176); // 2.2 g/kg body weight
  });

  it("prefers measured BMR and lean mass from a scan", () => {
    const t = calculateTargets({
      profile,
      goal: "lose_fat",
      pace: "moderate",
      scan: { weight_kg: 90, body_fat_pct: 30, bmr_kcal: 1700, scanned_on: "2026-10-18" },
    });
    expect(t.calculation).toMatchObject({ bmr: 1700, bmr_source: "scan", scan_date: "2026-10-18", lean_mass_kg: 63 });
    expect(t.calories).toBe(Math.round(1700 * 1.55) - 550);
    expect(t.protein_g).toBe(Math.round(63 * 2.6));
  });

  it("never goes below a safe calorie floor", () => {
    const small: Profile = { ...profile, sex: "female", weight_kg: 50, height_cm: 155, activity_level: "sedentary" };
    const t = calculateTargets({ profile: small, goal: "lose_fat", pace: "fast" });
    expect(t.calories).toBe(1200);
    expect(t.calculation!.floored).toBe(true);
  });

  it("flags missing profile fields and uses sex-specific micros", () => {
    const t = calculateTargets({ profile: { ...profile, sex: null, height_cm: null } });
    expect(t.calculation!.missing_profile).toEqual(["sex", "height"]);
    expect(calculateTargets({ profile }).micros.iron_mg).toBe(8);
    expect(calculateTargets({ profile: { ...profile, sex: "female" } }).micros.iron_mg).toBe(18);
  });
});

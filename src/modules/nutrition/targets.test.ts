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
  it("puts fat loss below maintenance and muscle gain above", () => {
    const maintain = calculateTargets({ profile, goal: "maintain" });
    const cut = calculateTargets({ profile, goal: "lose_fat" });
    const bulk = calculateTargets({ profile, goal: "build_muscle" });
    expect(cut.calories).toBeLessThan(maintain.calories);
    expect(bulk.calories).toBeGreaterThan(maintain.calories);
  });

  it("keeps macros consistent with calories", () => {
    const t = calculateTargets({ profile, goal: "recomp" });
    const fromMacros = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
    expect(Math.abs(fromMacros - t.calories)).toBeLessThan(15);
    expect(t.protein_g).toBe(176); // 2.2 g/kg
  });

  it("prefers measured BMR and lean mass from a scan", () => {
    const withScan = calculateTargets({ profile, goal: "lose_fat", scan: { weight_kg: 90, body_fat_pct: 30, bmr_kcal: 1700 } });
    expect(withScan.calories).toBe(Math.round(1700 * 1.55 * 0.8));
    expect(withScan.protein_g).toBe(Math.round(90 * 0.7 * 2.6));
  });

  it("uses sex-specific micronutrient targets", () => {
    const male = calculateTargets({ profile });
    const female = calculateTargets({ profile: { ...profile, sex: "female" } });
    expect(male.micros.iron_mg).toBe(8);
    expect(female.micros.iron_mg).toBe(18);
  });
});

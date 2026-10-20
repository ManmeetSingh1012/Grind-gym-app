import { ageFrom } from "@/lib/dates";
import type { GoalType } from "@/modules/goals/schemas";
import type { Profile } from "@/modules/profile/schemas";
import { MICRONUTRIENTS, round, type Micros } from "./nutrients";
import type { NutritionTargets, Pace, TargetCalculation } from "./schemas";

const ACTIVITY_FACTOR = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 } as const;

/** ~7700 kcal per kg of body-weight change. */
const KCAL_PER_KG = 7700;

/** Target weekly change (kg) for goals driven by a calorie deficit/surplus. */
export const WEEKLY_CHANGE_KG: Partial<Record<GoalType, Record<Pace, number>>> = {
  lose_fat: { slow: -0.25, moderate: -0.5, fast: -0.75 },
  build_muscle: { slow: 0.1, moderate: 0.25, fast: 0.4 },
};

/** Percentage adjustments for goals that sit close to maintenance. */
const PERCENT_ADJUST: Partial<Record<GoalType, Record<Pace, number>>> = {
  recomp: { slow: -0.05, moderate: -0.1, fast: -0.15 },
  strength: { slow: 0.03, moderate: 0.05, fast: 0.1 },
};

export const GOALS_WITH_PACE: GoalType[] = ["lose_fat", "build_muscle", "recomp", "strength"];

const PROTEIN_PER_KG: Record<GoalType, number> = {
  lose_fat: 2.2,
  recomp: 2.2,
  build_muscle: 2.0,
  strength: 1.8,
  endurance: 1.6,
  maintain: 1.6,
};

interface TargetInputs {
  profile: Profile;
  goal?: GoalType | null;
  pace?: Pace | null;
  /** From the latest body composition scan, when available. */
  scan?: { weight_kg?: number | null; body_fat_pct?: number | null; bmr_kcal?: number | null; scanned_on?: string } | null;
}

/**
 * Personal daily targets with the full working:
 * BMR (measured on the scan, else Mifflin-St Jeor) x activity = maintenance, then a
 * goal/pace adjustment. Protein scales with lean mass (or body weight), fat is 25% of
 * energy, carbs fill the rest. Micros use sex-specific reference intakes.
 */
export function calculateTargets({ profile, goal, pace, scan }: TargetInputs): NutritionTargets {
  const goalType = goal ?? "maintain";
  const chosenPace = pace ?? "moderate";
  const female = profile.sex === "female";

  const missing: string[] = [];
  if (!profile.sex) missing.push("sex");
  if (!profile.birth_date) missing.push("birth date");
  if (!profile.height_cm) missing.push("height");
  if (!scan?.weight_kg && !profile.weight_kg) missing.push("weight");

  const weight = scan?.weight_kg ?? profile.weight_kg ?? 75;
  const height = profile.height_cm ?? 175;
  const age = ageFrom(profile.birth_date) ?? 30;

  const bmr = Math.round(scan?.bmr_kcal ?? 10 * weight + 6.25 * height - 5 * age + (female ? -161 : 5));
  const factor = ACTIVITY_FACTOR[profile.activity_level];
  const maintenance = Math.round(bmr * factor);

  const weekly = WEEKLY_CHANGE_KG[goalType]?.[chosenPace] ?? null;
  const percent = PERCENT_ADJUST[goalType]?.[chosenPace] ?? 0;
  let adjustment = weekly != null ? Math.round((weekly * KCAL_PER_KG) / 7) : Math.round(maintenance * percent);

  // Never prescribe below a safe floor, however aggressive the pace.
  const floor = female ? 1200 : 1500;
  const floored = maintenance + adjustment < floor;
  if (floored) adjustment = floor - maintenance;
  const calories = maintenance + adjustment;

  // With a known body-fat %, base protein on lean mass to avoid overshooting at high body fat.
  const leanMass = scan?.body_fat_pct ? weight * (1 - scan.body_fat_pct / 100) : null;
  const proteinPerKg = leanMass ? PROTEIN_PER_KG[goalType] + 0.4 : PROTEIN_PER_KG[goalType];
  const protein = (leanMass ?? weight) * proteinPerKg;
  const fat = (calories * 0.25) / 9;
  const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);

  const calculation: TargetCalculation = {
    goal: goalType,
    pace: GOALS_WITH_PACE.includes(goalType) ? chosenPace : null,
    bmr,
    bmr_source: scan?.bmr_kcal ? "scan" : "formula",
    scan_date: scan?.scanned_on ?? null,
    activity_level: profile.activity_level,
    activity_factor: factor,
    maintenance,
    adjustment,
    // Expected weekly change implied by the final adjustment (after any floor).
    weekly_change_kg: round((adjustment * 7) / KCAL_PER_KG, 2) || null,
    floored,
    weight_kg: weight,
    lean_mass_kg: leanMass ? round(leanMass, 1) : null,
    protein_per_kg: round(proteinPerKg, 1),
    missing_profile: missing,
  };

  return {
    calories,
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat),
    micros: microTargets(female, calories),
    source: "calculated",
    goal_type: goalType,
    pace: calculation.pace,
    calculation,
  };
}

export function microTargets(female: boolean, calories: number): Micros {
  const micros: Micros = {};
  for (const n of MICRONUTRIENTS) micros[n.key] = female ? n.female : n.male;
  // Energy-relative limits (WHO / Dietary Guidelines: < 10% of energy each).
  micros.saturated_fat_g = round((calories * 0.1) / 9, 0);
  micros.sugar_g = round((calories * 0.1) / 4, 0);
  // Fiber: 14 g per 1000 kcal.
  micros.fiber_g = Math.max(female ? 25 : 30, round((calories / 1000) * 14, 0));
  return micros;
}

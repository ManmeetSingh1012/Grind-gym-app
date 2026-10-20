import { ageFrom } from "@/lib/dates";
import type { GoalType } from "@/modules/goals/schemas";
import type { Profile } from "@/modules/profile/schemas";
import { MICRONUTRIENTS, round, type Micros } from "./nutrients";
import type { NutritionTargets } from "./schemas";

const ACTIVITY_FACTOR = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 } as const;

const GOAL_CALORIE_ADJUST: Record<GoalType, number> = {
  lose_fat: -0.2,
  recomp: -0.1,
  maintain: 0,
  endurance: 0,
  strength: 0.05,
  build_muscle: 0.1,
};

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
  /** From the latest body composition scan, when available. */
  scan?: { weight_kg?: number | null; body_fat_pct?: number | null; bmr_kcal?: number | null } | null;
}

/**
 * Personal daily targets: Mifflin-St Jeor BMR (or the scan's measured BMR) x activity,
 * adjusted for the goal. Protein scales with body weight, fat is 25% of energy,
 * carbs fill the rest. Micros use sex-specific reference intakes.
 */
export function calculateTargets({ profile, goal, scan }: TargetInputs): NutritionTargets {
  const weight = scan?.weight_kg ?? profile.weight_kg ?? 75;
  const height = profile.height_cm ?? 175;
  const age = ageFrom(profile.birth_date) ?? 30;
  const female = profile.sex === "female";

  const bmr = scan?.bmr_kcal ?? 10 * weight + 6.25 * height - 5 * age + (female ? -161 : 5);
  const tdee = bmr * ACTIVITY_FACTOR[profile.activity_level];
  const goalType = goal ?? "maintain";
  const calories = Math.round(tdee * (1 + GOAL_CALORIE_ADJUST[goalType]));

  // With a known body-fat %, base protein on lean mass to avoid overshooting at high body fat.
  const leanMass = scan?.body_fat_pct ? weight * (1 - scan.body_fat_pct / 100) : null;
  const protein = leanMass ? leanMass * (PROTEIN_PER_KG[goalType] + 0.4) : weight * PROTEIN_PER_KG[goalType];
  const fat = (calories * 0.25) / 9;
  const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);

  return {
    calories,
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat),
    micros: microTargets(female, calories),
    source: "calculated",
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

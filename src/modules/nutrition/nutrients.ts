/**
 * Micronutrient catalogue. Keys are what we store in `food_logs.micros` and
 * `nutrition_targets.micros`. RDA values are adult (19-50) reference intakes
 * from the US Dietary Reference Intakes; `kind: "limit"` means "stay under".
 */
export const MICRONUTRIENTS = [
  { key: "fiber_g", label: "Fiber", unit: "g", male: 38, female: 25, kind: "target", usda: [1079] },
  { key: "sugar_g", label: "Sugar", unit: "g", male: 50, female: 50, kind: "limit", usda: [2000] },
  { key: "saturated_fat_g", label: "Saturated fat", unit: "g", male: 22, female: 20, kind: "limit", usda: [1258] },
  { key: "cholesterol_mg", label: "Cholesterol", unit: "mg", male: 300, female: 300, kind: "limit", usda: [1253] },
  { key: "sodium_mg", label: "Sodium", unit: "mg", male: 2300, female: 2300, kind: "limit", usda: [1093] },
  { key: "potassium_mg", label: "Potassium", unit: "mg", male: 3400, female: 2600, kind: "target", usda: [1092] },
  { key: "calcium_mg", label: "Calcium", unit: "mg", male: 1000, female: 1000, kind: "target", usda: [1087] },
  { key: "iron_mg", label: "Iron", unit: "mg", male: 8, female: 18, kind: "target", usda: [1089] },
  { key: "magnesium_mg", label: "Magnesium", unit: "mg", male: 420, female: 320, kind: "target", usda: [1090] },
  { key: "phosphorus_mg", label: "Phosphorus", unit: "mg", male: 700, female: 700, kind: "target", usda: [1091] },
  { key: "zinc_mg", label: "Zinc", unit: "mg", male: 11, female: 8, kind: "target", usda: [1095] },
  { key: "selenium_ug", label: "Selenium", unit: "µg", male: 55, female: 55, kind: "target", usda: [1103] },
  { key: "vitamin_a_ug", label: "Vitamin A", unit: "µg", male: 900, female: 700, kind: "target", usda: [1106] },
  { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg", male: 90, female: 75, kind: "target", usda: [1162] },
  { key: "vitamin_d_ug", label: "Vitamin D", unit: "µg", male: 15, female: 15, kind: "target", usda: [1114] },
  { key: "vitamin_e_mg", label: "Vitamin E", unit: "mg", male: 15, female: 15, kind: "target", usda: [1109] },
  { key: "vitamin_k_ug", label: "Vitamin K", unit: "µg", male: 120, female: 90, kind: "target", usda: [1185] },
  { key: "thiamin_mg", label: "Thiamin (B1)", unit: "mg", male: 1.2, female: 1.1, kind: "target", usda: [1165] },
  { key: "riboflavin_mg", label: "Riboflavin (B2)", unit: "mg", male: 1.3, female: 1.1, kind: "target", usda: [1166] },
  { key: "niacin_mg", label: "Niacin (B3)", unit: "mg", male: 16, female: 14, kind: "target", usda: [1167] },
  { key: "vitamin_b6_mg", label: "Vitamin B6", unit: "mg", male: 1.3, female: 1.3, kind: "target", usda: [1175] },
  { key: "folate_ug", label: "Folate", unit: "µg", male: 400, female: 400, kind: "target", usda: [1190, 1177] },
  { key: "vitamin_b12_ug", label: "Vitamin B12", unit: "µg", male: 2.4, female: 2.4, kind: "target", usda: [1178] },
  { key: "omega3_g", label: "Omega-3", unit: "g", male: 1.6, female: 1.1, kind: "target", usda: [1404, 1278, 1272] },
] as const;

export type MicroKey = (typeof MICRONUTRIENTS)[number]["key"];
export type Micros = Partial<Record<MicroKey, number>>;

export const MICRO_KEYS = MICRONUTRIENTS.map((n) => n.key) as [MicroKey, ...MicroKey[]];

export const MACRO_USDA_IDS = { calories: 1008, protein_g: 1003, fat_g: 1004, carbs_g: 1005 } as const;

export function scaleMicros(micros: Micros, factor: number): Micros {
  const out: Micros = {};
  for (const [k, v] of Object.entries(micros) as [MicroKey, number][]) out[k] = round(v * factor);
  return out;
}

export function round(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

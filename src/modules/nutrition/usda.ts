import "server-only";
import { z } from "zod";
import { upstream } from "@/lib/api/errors";
import { serverEnv } from "@/lib/env";
import { MACRO_USDA_IDS, MICRONUTRIENTS, round, type Micros } from "./nutrients";
import type { FoodCandidate } from "./schemas";

const searchResponse = z.object({
  foods: z.array(
    z.object({
      fdcId: z.number(),
      description: z.string(),
      brandName: z.string().optional(),
      dataType: z.string().optional(),
      foodNutrients: z.array(
        z.object({ nutrientId: z.number(), value: z.number().optional(), unitName: z.string().optional() }),
      ),
    }),
  ),
});

/**
 * USDA FoodData Central search. Values for Foundation / SR Legacy / Branded
 * search results are per 100 g, so candidates are returned as 100 g portions.
 */
export async function searchUsdaFoods(query: string): Promise<FoodCandidate[]> {
  // USDA rejects `+` for spaces (URLSearchParams' encoding), so encode with %20.
  // No explicit dataType filter: naming "Survey (FNDDS)" makes some queries 400, while the
  // unfiltered search covers the same data types.
  const params = { api_key: serverEnv().USDA_API_KEY, query, pageSize: "30" };
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${qs}`).catch(() => {
    throw upstream("Food database is unreachable. Check your connection and try again.");
  });
  if (res.status === 429) {
    throw upstream("Food database rate limit reached. Add a free USDA_API_KEY to raise it, or use Describe.");
  }
  if (!res.ok) throw upstream(`Food database error (${res.status})`);
  const parsed = searchResponse.safeParse(await res.json());
  if (!parsed.success) throw upstream("Unexpected food database response");

  const ranked = [...parsed.data.foods].sort((a, b) => typeRank(a.dataType) - typeRank(b.dataType)).slice(0, 12);
  return ranked.flatMap((f) => {
    const byId = new Map(f.foodNutrients.map((n) => [n.nutrientId, n.value ?? 0]));
    const micros: Micros = {};
    for (const n of MICRONUTRIENTS) {
      const ids: readonly number[] = n.usda;
      // Most ids are parts of a whole (omega-3 = ALA + EPA + DHA) and add up; for folate and
      // sugar they are alternative measurements, so take the first one present.
      const value = ALTERNATIVE_IDS.has(n.key)
        ? (ids.map((id) => byId.get(id)).find((v) => v != null) ?? 0)
        : ids.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
      if (value) micros[n.key] = round(value);
    }
    // Foundation foods may report energy only as Atwater values (2047 general, 2048 specific).
    const calories = byId.get(MACRO_USDA_IDS.calories) || byId.get(2048) || byId.get(2047) || 0;
    // Some records in search results carry no energy/macro data at all; skip rather than show 0 kcal.
    if (!calories) return [];

    return [
      {
        ref: `usda:${f.fdcId}`,
        name: f.brandName ? `${titleCase(f.description)} (${f.brandName})` : titleCase(f.description),
        quantity: 100,
        unit: "g",
        grams_per_unit: 1,
        calories: round(calories, 0),
        protein_g: round(byId.get(MACRO_USDA_IDS.protein_g) ?? 0, 1),
        carbs_g: round(byId.get(MACRO_USDA_IDS.carbs_g) ?? 0, 1),
        fat_g: round(byId.get(MACRO_USDA_IDS.fat_g) ?? 0, 1),
        micros,
        source: "usda" as const,
      },
    ];
  });
}

const ALTERNATIVE_IDS = new Set<string>(["folate_ug", "sugar_g"]);

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Generic reference foods first; branded products (often odd serving data) last. */
function typeRank(dataType?: string) {
  const order = ["Foundation", "SR Legacy", "Survey (FNDDS)"];
  const i = dataType ? order.indexOf(dataType) : -1;
  return i === -1 ? order.length : i;
}

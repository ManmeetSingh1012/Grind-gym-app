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
  const params = {
    api_key: serverEnv().USDA_API_KEY,
    query,
    pageSize: "12",
    dataType: "Foundation,SR Legacy,Survey (FNDDS),Branded",
  };
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

  return parsed.data.foods.map((f) => {
    const byId = new Map(f.foodNutrients.map((n) => [n.nutrientId, n.value ?? 0]));
    const micros: Micros = {};
    for (const n of MICRONUTRIENTS) {
      const total = n.usda.reduce((sum: number, id) => sum + (byId.get(id) ?? 0), 0);
      // Folate: prefer DFE (first id) over total folate when both exist.
      const value = n.key === "folate_ug" ? (byId.get(1190) ?? byId.get(1177) ?? 0) : total;
      if (value) micros[n.key] = round(value);
    }
    return {
      ref: `usda:${f.fdcId}`,
      name: f.brandName ? `${titleCase(f.description)} (${f.brandName})` : titleCase(f.description),
      quantity: 100,
      unit: "g",
      grams_per_unit: 1,
      calories: round(byId.get(MACRO_USDA_IDS.calories) ?? 0, 0),
      protein_g: round(byId.get(MACRO_USDA_IDS.protein_g) ?? 0, 1),
      carbs_g: round(byId.get(MACRO_USDA_IDS.carbs_g) ?? 0, 1),
      fat_g: round(byId.get(MACRO_USDA_IDS.fat_g) ?? 0, 1),
      micros,
      source: "usda" as const,
    };
  });
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

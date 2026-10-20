import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ USDA_API_KEY: "TEST_KEY" }) }));

const { searchUsdaFoods } = await import("./usda");

const sample = {
  foods: [
    {
      fdcId: 173944,
      description: "BANANAS, RAW",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: 1008, value: 89 },
        { nutrientId: 1003, value: 1.09 },
        { nutrientId: 1004, value: 0.33 },
        { nutrientId: 1005, value: 22.84 },
        { nutrientId: 1079, value: 2.6 },
        { nutrientId: 1092, value: 358 },
        { nutrientId: 1177, value: 20 },
        { nutrientId: 1404, value: 0.027 },
        { nutrientId: 1272, value: 0.01 },
      ],
    },
    { fdcId: 2, description: "BANANA CHIPS", brandName: "ACME", foodNutrients: [{ nutrientId: 1008 }] },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("searchUsdaFoods", () => {
  it("maps USDA nutrients to per-100g candidates", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(sample)));
    vi.stubGlobal("fetch", fetchMock);

    const [banana, chips] = await searchUsdaFoods("banana split");

    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("query=banana%20split");
    expect(url).not.toContain("+");
    expect(banana).toMatchObject({
      ref: "usda:173944",
      name: "Bananas, Raw",
      quantity: 100,
      unit: "g",
      calories: 89,
      protein_g: 1.1,
      carbs_g: 22.8,
      fat_g: 0.3,
      source: "usda",
    });
    expect(banana.micros).toMatchObject({ fiber_g: 2.6, potassium_mg: 358, folate_ug: 20, omega3_g: 0.04 });
    expect(chips.name).toBe("Banana Chips (ACME)");
    expect(chips.calories).toBe(0);
  });

  it("explains rate limiting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(searchUsdaFoods("rice")).rejects.toThrow(/rate limit/);
  });
});

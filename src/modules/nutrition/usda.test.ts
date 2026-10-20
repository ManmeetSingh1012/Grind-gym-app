import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ USDA_API_KEY: "TEST_KEY" }) }));

const { searchUsdaFoods } = await import("./usda");

const sample = {
  foods: [
    {
      fdcId: 2,
      description: "BANANA CHIPS",
      brandName: "ACME",
      dataType: "Branded",
      foodNutrients: [{ nutrientId: 1008, value: 519 }, { nutrientId: 2000, value: 35 }],
    },
    { fdcId: 3, description: "BANANA, NO DATA", dataType: "Foundation", foodNutrients: [{ nutrientId: 1051, value: 74 }] },
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
        { nutrientId: 2000, value: 12.2 },
        { nutrientId: 1063, value: 12.0 },
      ],
    },
    {
      fdcId: 4,
      description: "BANANA, FOUNDATION",
      dataType: "Foundation",
      foodNutrients: [{ nutrientId: 2047, value: 97 }, { nutrientId: 1063, value: 15.8 }],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("searchUsdaFoods", () => {
  it("maps USDA nutrients to ranked per-100g candidates", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(sample)));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchUsdaFoods("banana split");

    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("query=banana%20split");
    expect(url).not.toContain("+");
    expect(url).not.toContain("dataType");

    // Generic reference foods first, branded last; records without energy are dropped.
    expect(results.map((r) => r.ref)).toEqual(["usda:4", "usda:173944", "usda:2"]);

    const [foundation, banana, chips] = results;
    expect(foundation).toMatchObject({ calories: 97, micros: { sugar_g: 15.8 } }); // Atwater energy + alt sugar id
    expect(banana).toMatchObject({
      name: "Bananas, Raw",
      quantity: 100,
      unit: "g",
      calories: 89,
      protein_g: 1.1,
      carbs_g: 22.8,
      fat_g: 0.3,
      source: "usda",
    });
    // Sugar: first id only (no double counting); omega-3: parts add up.
    expect(banana.micros).toMatchObject({ fiber_g: 2.6, potassium_mg: 358, folate_ug: 20, omega3_g: 0.04, sugar_g: 12.2 });
    expect(chips.name).toBe("Banana Chips (ACME)");
  });

  it("explains rate limiting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(searchUsdaFoods("rice")).rejects.toThrow(/rate limit/);
  });
});

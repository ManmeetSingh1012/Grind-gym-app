import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import { extractedScanSchema, planSchema } from "@/modules/body/schemas";
import { workoutInsightsSchema } from "@/modules/coach/schemas";
import { exerciseLookupResult } from "@/modules/exercises/schemas";
import { parsedMealSchema } from "@/modules/nutrition/schemas";

const AI_SCHEMAS = {
  exercise_lookup: exerciseLookupResult,
  parsed_meal: parsedMealSchema,
  body_scan: extractedScanSchema,
  body_plan: planSchema,
  workout_insights: workoutInsightsSchema,
};

describe("AI output schemas", () => {
  for (const [name, schema] of Object.entries(AI_SCHEMAS)) {
    it(`${name} converts to a strict OpenAI JSON schema`, () => {
      const format = zodTextFormat(schema, name);
      expect(format.strict).toBe(true);
      expect(JSON.stringify(format.schema)).toContain('"additionalProperties":false');
    });

    it(`${name} converts to a Claude output format`, () => {
      expect(() => betaZodOutputFormat(schema)).not.toThrow();
    });
  }
});

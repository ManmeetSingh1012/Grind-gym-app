import { describe, expect, it } from "vitest";
import { parseSpokenSets } from "./voice";

describe("parseSpokenSets", () => {
  it.each([
    ["80 kg 8 reps", { weight_kg: 80, reps: 8, sets: 1 }],
    ["80 kg for 8", { weight_kg: 80, reps: 8, sets: 1 }],
    ["80 for 8", { weight_kg: 80, reps: 8, sets: 1 }],
    ["80 x 8", { weight_kg: 80, reps: 8, sets: 1 }],
    ["8 reps at 80", { weight_kg: 80, reps: 8, sets: 1 }],
    ["3 sets of 10 at 60", { weight_kg: 60, reps: 10, sets: 3 }],
    ["3x10 at 60 kg", { weight_kg: 60, reps: 10, sets: 3 }],
    ["60 kilo 3 sets 10 reps", { weight_kg: 60, reps: 10, sets: 3 }],
    ["eighty kg eight reps", { weight_kg: 80, reps: 8, sets: 1 }],
    ["22.5 kg 12 reps", { weight_kg: 22.5, reps: 12, sets: 1 }],
    ["bodyweight 12 reps", { weight_kg: 0, reps: 12, sets: 1 }],
    ["100 pounds 5 reps", { weight_kg: 45.5, reps: 5, sets: 1 }],
    ["two sets of twelve with 20 kg", { weight_kg: 20, reps: 12, sets: 2 }],
  ])("%s", (text, expected) => {
    expect(parseSpokenSets(text)).toEqual(expected);
  });

  it("uses the fallback weight when only reps are spoken", () => {
    expect(parseSpokenSets("12 reps", 40)).toEqual({ weight_kg: 40, reps: 12, sets: 1 });
    expect(parseSpokenSets("ten", 40)).toEqual({ weight_kg: 40, reps: 10, sets: 1 });
  });

  it("returns null when no reps can be found", () => {
    expect(parseSpokenSets("hello there")).toBeNull();
    expect(parseSpokenSets("80 kg")).toBeNull();
  });
});

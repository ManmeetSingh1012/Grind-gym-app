import { describe, expect, it } from "vitest";
import { dueSlot, motivationMessage, windowAt } from "./messages";

const at = (h: number, m = 0) => new Date(2026, 10, 19, h, m);

describe("motivation windows", () => {
  it("only fires 12-3 pm and 5-10 pm", () => {
    expect(windowAt(at(11, 59))).toBeNull();
    expect(windowAt(at(12, 0))).toBe("afternoon");
    expect(windowAt(at(14, 59))).toBe("afternoon");
    expect(windowAt(at(15, 30))).toBeNull();
    expect(windowAt(at(17, 0))).toBe("evening");
    expect(windowAt(at(21, 59))).toBe("evening");
    expect(windowAt(at(22, 0))).toBeNull();
  });

  it("finds the due slot once", () => {
    const slot = dueSlot(at(18, 40), []);
    expect(slot?.minute).toBe(18 * 60 + 30);
    expect(dueSlot(at(18, 40), [18 * 60 + 30])).toBeNull();
    expect(dueSlot(at(16, 0), [])).toBeNull();
  });

  it("tailors the evening nudge to whether you trained", () => {
    expect(motivationMessage("evening", "savage", { trainedToday: false }).title).toMatch(/gym/i);
    expect(motivationMessage("evening", "clean", { trainedToday: true, proteinLeft: 50 }).body).toMatch(/50 g protein/);
  });
});

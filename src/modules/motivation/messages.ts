/**
 * Motivation pushes. Two windows a day: afternoon (12–3 pm) and evening (5–10 pm).
 * "savage" is the gaand-faad mode; "clean" keeps it family-friendly.
 */
export type Tone = "savage" | "clean";
export type Window = "afternoon" | "evening";
export type DayContext = { trainedToday?: boolean; proteinLeft?: number; kcalLeft?: number; name?: string | null };

export const WINDOWS: Record<Window, { start: number; end: number; label: string }> = {
  afternoon: { start: 12, end: 15, label: "12 – 3 pm" },
  evening: { start: 17, end: 22, label: "5 – 10 pm" },
};

/** Minutes after midnight at which a nudge is due. Each fires at most once a day. */
export const SLOTS: { window: Window; minute: number }[] = [
  { window: "afternoon", minute: 12 * 60 + 15 },
  { window: "afternoon", minute: 13 * 60 + 30 },
  { window: "afternoon", minute: 14 * 60 + 40 },
  { window: "evening", minute: 17 * 60 + 15 },
  { window: "evening", minute: 18 * 60 + 30 },
  { window: "evening", minute: 19 * 60 + 45 },
  { window: "evening", minute: 21 * 60 + 15 },
];

const SAVAGE: Record<Window, string[]> = {
  afternoon: [
    "Lunch ke baad sona nahi hai. Protein maar, aur shaam ko gaand faad workout ki tayyari kar. 🔥",
    "Aadha din gaya. Excuses wahi purane, body bhi wahi purani. Utth aur kuch kar.",
    "Sofa tera dushman hai. Paani pee, protein le, aur shaam ka plan lock kar.",
    "Tu thaka nahi hai, tu bored hai. Bored log body nahi banate. Chal grind kar.",
    "Jo aaj skip karega, kal mirror mein wahi dikhega. Discipline > mood.",
  ],
  evening: [
    "Gym ka time ho gaya. Gaand faad de aaj, weights wait kar rahe hain. 🏋️",
    "Aaj ka pump kal ka confidence hai. Shoes pehen, abhi nikal.",
    "Koi nahi aayega tujhe bachane. Tu khud hi apna hero hai. Rack pe chal.",
    "Pain temporary hai, quitting permanent. Ek aur set, ek aur rep.",
    "Phone neeche, dumbbell upar. Aaj PR todna hai.",
    "Log so rahe hain, tu bana raha hai. Ye hi farak hai. Chal shuru kar.",
  ],
};

const CLEAN: Record<Window, string[]> = {
  afternoon: [
    "Halfway through the day. Hit your protein and plan tonight's session.",
    "Afternoon slump? Water, a walk and a high-protein snack. Then lock in.",
    "Small wins stack. Log lunch and keep the streak alive.",
  ],
  evening: [
    "Training time. Show up, warm up, and beat last week's numbers.",
    "One more set than yesterday. That's how progress is built.",
    "Your future self is watching. Go earn it.",
    "Discipline beats motivation. Get to the gym.",
  ],
};

function pick<T>(list: T[], seed: number) {
  return list[Math.abs(seed) % list.length];
}

/** A nudge for the given window, tailored to what's done today when we know it. */
export function motivationMessage(window: Window, tone: Tone, ctx: DayContext = {}, seed = Date.now()): { title: string; body: string } {
  const savage = tone === "savage";
  const name = ctx.name ? `${ctx.name}, ` : "";

  if (window === "evening" && ctx.trainedToday === false) {
    return {
      title: savage ? "Aaj gym nahi gaya abhi tak? 😤" : "No workout logged yet",
      body: savage
        ? `${name}abhi bhi time hai. 45 minute. Gaand faad session. Koi bahana nahi.`
        : `${name}there's still time today. 45 focused minutes is enough.`,
    };
  }
  if (window === "evening" && ctx.trainedToday) {
    if (ctx.proteinLeft && ctx.proteinLeft > 25) {
      return {
        title: savage ? "Workout done, ab khaana bhi kar 💪" : "Great session. Now recover.",
        body: `${Math.round(ctx.proteinLeft)} g protein left today. ${savage ? "Muscle hawa se nahi banti." : "Muscles grow when you eat."}`,
      };
    }
    return {
      title: savage ? "Beast mode complete 🔥" : "Workout done ✅",
      body: savage ? "Aaj ka kaam ho gaya. Kal isse bhi zyada gaand faadni hai." : "Sleep well and come back stronger tomorrow.",
    };
  }
  if (window === "afternoon" && ctx.proteinLeft && ctx.proteinLeft > 60) {
    return {
      title: savage ? "Protein kahan hai bhai? 🍗" : "Protein check",
      body: `${Math.round(ctx.proteinLeft)} g protein still to go. ${savage ? "Abhi kha, warna shaam ko pump nahi aayega." : "Add a protein-rich snack now."}`,
    };
  }

  const list = (savage ? SAVAGE : CLEAN)[window];
  return { title: savage ? "GRIND TIME 🔥" : "Grind", body: pick(list, seed) };
}

export function windowAt(date: Date): Window | null {
  const h = date.getHours();
  if (h >= WINDOWS.afternoon.start && h < WINDOWS.afternoon.end) return "afternoon";
  if (h >= WINDOWS.evening.start && h < WINDOWS.evening.end) return "evening";
  return null;
}

/** The slot that is due now (within 45 min after its time and still in its window), if any. */
export function dueSlot(now: Date, firedToday: number[]): (typeof SLOTS)[number] | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  const w = windowAt(now);
  if (!w) return null;
  // Latest due slot only, so reopening the app late doesn't spam several at once.
  const due = SLOTS.filter((s) => s.window === w && minute >= s.minute && minute < s.minute + 45);
  const slot = due.at(-1);
  return slot && !firedToday.includes(slot.minute) ? slot : null;
}

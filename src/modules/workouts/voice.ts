/**
 * Turns a spoken set description into sets, without an AI round-trip.
 * Handles e.g. "80 kg 8 reps", "80 for 8", "8 reps at 80", "3 sets of 10 at 60",
 * "3x10 at 60 kg", "100 pounds 5", "bodyweight 12", "12 reps" (weight from `fallbackWeight`).
 */
export type SpokenSets = { weight_kg: number; reps: number; sets: number };

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100, a: 1, single: 1, double: 2, triple: 3,
};

const LB_TO_KG = 0.45359237;
const NUM = String.raw`(\d+(?:\.\d+)?)`;

function normalize(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/×|✕/g, " x ")
      .replace(/(\d),(\d)/g, "$1.$2") // "22,5" -> 22.5
      .replace(/\band a half\b/g, ".5")
      // Word numbers -> digits ("eight reps" -> "8 reps"); "a" only before set/rep words.
      .replace(/\b(a|single|double|triple)\b(?=\s+(?:set|sets|rep|reps)\b)/g, (w) => String(WORD_NUMBERS[w]))
      .replace(
        /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/g,
        (w) => String(WORD_NUMBERS[w]),
      )
      .replace(/(\d)\s*\.5/g, "$1.5")
      .replace(/(\d)x(\d)/g, "$1 x $2")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function parseSpokenSets(text: string, fallbackWeight?: number): SpokenSets | null {
  let s = normalize(text);
  let weight: number | null = null;
  let reps: number | null = null;
  let sets: number | null = null;

  const take = (re: RegExp) => {
    const m = s.match(re);
    if (m) s = s.replace(m[0], " ");
    return m;
  };

  if (/\b(body ?weight|bw|no weight)\b/.test(s)) {
    weight = 0;
    s = s.replace(/\b(body ?weight|bw|no weight)\b/, " ");
  }

  // Explicit units first.
  let m = take(new RegExp(`${NUM}\\s*(kgs?|kilos?|kilograms?|kg's)\\b`));
  if (m) weight = Number(m[1]);
  else if ((m = take(new RegExp(`${NUM}\\s*(lbs?|pounds?)\\b`)))) weight = Math.round(Number(m[1]) * LB_TO_KG * 2) / 2;

  if ((m = take(new RegExp(`${NUM}\\s*sets?\\s*(?:of|x|into|by)?\\s*${NUM}`)))) {
    sets = Number(m[1]);
    reps = Number(m[2]);
  }
  if (sets == null && (m = take(new RegExp(`${NUM}\\s*sets?\\b`)))) sets = Number(m[1]);
  if (reps == null && (m = take(new RegExp(`${NUM}\\s*(?:reps?|repetitions?|times)\\b`)))) reps = Number(m[1]);
  if (reps == null && (m = take(new RegExp(`(?:reps?|repetitions?)\\s*${NUM}`)))) reps = Number(m[1]);
  if (weight == null && (m = take(new RegExp(`(?:at|@|with|of|on)\\s*${NUM}`)))) weight = Number(m[1]);

  // "A x B", "A for B", "A by B", "A into B".
  if ((m = take(new RegExp(`${NUM}\\s*(?:x|for|by|into|times)\\s*${NUM}`)))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (weight != null) {
      // Weight is known, so "3 x 10" means sets x reps.
      if (sets == null) sets = a;
      if (reps == null) reps = b;
    } else {
      weight = a;
      if (reps == null) reps = b;
    }
  }

  // Leftover bare numbers.
  const rest = [...s.matchAll(new RegExp(NUM, "g"))].map((x) => Number(x[1]));
  if (weight == null && reps == null && rest.length >= 2) [weight, reps] = rest;
  else if (reps == null && rest.length) reps = rest[weight == null && rest.length > 1 ? 1 : 0];
  else if (weight == null && rest.length) weight = rest[0];

  if (reps == null || !Number.isFinite(reps) || reps <= 0) return null;
  weight ??= fallbackWeight ?? 0;
  return {
    weight_kg: Math.max(0, Math.min(1000, weight)),
    reps: Math.min(500, Math.round(reps)),
    sets: Math.max(1, Math.min(10, Math.round(sets ?? 1))),
  };
}

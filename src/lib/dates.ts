/** YYYY-MM-DD in the runtime's local timezone. */
export function toIsoDate(d: Date = new Date()) {
  return d.toLocaleDateString("en-CA");
}

export function daysAgoIso(days: number) {
  return toIsoDate(new Date(Date.now() - days * 86_400_000));
}

/** 1 = Monday … 7 = Sunday */
export function isoWeekday(d: Date = new Date()) {
  return ((d.getDay() + 6) % 7) + 1;
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`;
}

export function formatDate(iso: string) {
  // Parse date-only strings as local dates, not UTC midnight.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ageFrom(birthDate: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
}

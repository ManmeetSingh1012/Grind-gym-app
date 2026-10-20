import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import { badRequest, notFound } from "@/lib/api/errors";
import { unwrap } from "@/lib/api/handler";
import { toIsoDate } from "@/lib/dates";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  bodyScanSchema,
  extractedScanSchema,
  SCAN_MAX_BYTES,
  SCAN_MIME_TYPES,
  type BodyScan,
  type UpdateScanInput,
} from "./schemas";

const BUCKET = "body-scans";

export async function listScans(db: SupabaseServerClient): Promise<BodyScan[]> {
  const rows = z
    .array(bodyScanSchema)
    .parse(unwrap(await db.from("body_scans").select("*").order("scanned_on", { ascending: false }).limit(50)));

  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
  const { data: signed } = paths.length
    ? await db.storage.from(BUCKET).createSignedUrls(paths, 60 * 60)
    : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, image_url: r.image_path ? (urlByPath.get(r.image_path) ?? null) : null }));
}

export async function latestScan(db: SupabaseServerClient): Promise<BodyScan | null> {
  const row = unwrap(
    await db.from("body_scans").select("*").order("scanned_on", { ascending: false }).limit(1).maybeSingle(),
  );
  return row ? bodyScanSchema.parse(row) : null;
}

export async function getScan(db: SupabaseServerClient, id: string): Promise<BodyScan> {
  const row = unwrap(await db.from("body_scans").select("*").eq("id", id).maybeSingle());
  if (!row) throw notFound("Body scan");
  return bodyScanSchema.parse(row);
}

const EXTRACT_SYSTEM = `You read body composition analysis reports (InBody, Tanita, DEXA summaries, smart-scale screenshots).
Extract the values exactly as printed. Convert pounds to kg and use null for anything not present - never guess.`;

/** Stores the image privately, has Claude read the values off it, and saves the scan. */
export async function uploadScan(db: SupabaseServerClient, userId: string, file: File): Promise<BodyScan> {
  if (!SCAN_MIME_TYPES.includes(file.type as (typeof SCAN_MIME_TYPES)[number])) {
    throw badRequest("Upload a JPEG, PNG, WebP or GIF image of your report");
  }
  if (file.size > SCAN_MAX_BYTES) throw badRequest("Image must be 8 MB or smaller");

  const bytes = Buffer.from(await file.arrayBuffer());
  const extracted = await generateStructured({
    schema: extractedScanSchema,
    name: "body_scan",
    system: EXTRACT_SYSTEM,
    effort: "medium",
    content: {
      text: "Extract every value from this body composition report.",
      images: [{ mediaType: file.type as (typeof SCAN_MIME_TYPES)[number], base64: bytes.toString("base64") }],
    },
  });
  if (!extracted.is_body_composition_report) {
    throw badRequest("That doesn't look like a body composition report. Try a clearer photo.");
  }

  const ext = file.type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type });
  if (error) throw error;

  const { other, is_body_composition_report: _, scanned_on, ...values } = extracted;
  const row = unwrap(
    await db
      .from("body_scans")
      .insert({
        ...values,
        bmr_kcal: values.bmr_kcal == null ? null : Math.round(values.bmr_kcal),
        scanned_on: scanned_on && /^\d{4}-\d{2}-\d{2}$/.test(scanned_on) ? scanned_on : toIsoDate(),
        image_path: path,
        metrics: { other },
      })
      .select("*")
      .single(),
  );

  // Keep the profile weight in sync with the newest measurement.
  if (values.weight_kg) await db.from("profiles").update({ weight_kg: values.weight_kg }).eq("id", userId);

  return bodyScanSchema.parse(row);
}

export async function updateScan(db: SupabaseServerClient, id: string, input: UpdateScanInput) {
  const row = unwrap(await db.from("body_scans").update(input).eq("id", id).select("*").maybeSingle());
  if (!row) throw notFound("Body scan");
  return bodyScanSchema.parse(row);
}

export async function deleteScan(db: SupabaseServerClient, id: string) {
  const scan = await getScan(db, id);
  if (scan.image_path) await db.storage.from(BUCKET).remove([scan.image_path]);
  unwrap(await db.from("body_scans").delete().eq("id", id));
}


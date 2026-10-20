import { badRequest } from "@/lib/api/errors";
import { apiRoute } from "@/lib/api/handler";
import { listScans, uploadScan } from "@/modules/body/service";

export const maxDuration = 60;

export const GET = apiRoute({}, ({ supabase }) => listScans(supabase));

/** multipart/form-data with a `file` field holding the report image. */
export const POST = apiRoute({ status: 201 }, async ({ req, supabase, userId }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Attach the report image as `file`");
  return uploadScan(supabase, userId, file);
});

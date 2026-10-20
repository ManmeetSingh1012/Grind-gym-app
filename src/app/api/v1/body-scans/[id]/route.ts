import { apiRoute } from "@/lib/api/handler";
import { updateScanInput } from "@/modules/body/schemas";
import { deleteScan, updateScan } from "@/modules/body/service";

export const PATCH = apiRoute({ body: updateScanInput }, ({ supabase, params, body }) =>
  updateScan(supabase, params.id, body),
);

export const DELETE = apiRoute({}, ({ supabase, params }) => deleteScan(supabase, params.id));

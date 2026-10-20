import { apiRoute } from "@/lib/api/handler";
import { foodSearchQuery } from "@/modules/nutrition/schemas";
import { searchUsdaFoods } from "@/modules/nutrition/usda";

export const GET = apiRoute({ query: foodSearchQuery }, ({ query }) => searchUsdaFoods(query.q));

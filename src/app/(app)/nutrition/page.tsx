import type { Metadata } from "next";
import { NutritionDay } from "@/modules/nutrition/components/nutrition-day";

export const metadata: Metadata = { title: "Food" };

export default function NutritionPage() {
  return <NutritionDay />;
}

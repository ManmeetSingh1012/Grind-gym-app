import type { Metadata } from "next";
import { DietChat } from "@/modules/diet-chat/components/diet-chat";

export const metadata: Metadata = { title: "Diet coach" };

export default function CoachPage() {
  return <DietChat />;
}

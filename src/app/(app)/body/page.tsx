import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/bottom-nav";
import { PlanSection } from "@/modules/body/components/plan-section";
import { ScansSection } from "@/modules/body/components/scans-section";

export const metadata: Metadata = { title: "Body" };

export default function BodyPage() {
  return (
    <>
      <PageHeader title="Body" subtitle="Composition, trends and your AI plan" />
      <div className="flex flex-col gap-6">
        <ScansSection />
        <PlanSection />
      </div>
    </>
  );
}

import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { GoalsSection } from "@/modules/goals/components/goals-section";
import { McpConnectCard } from "@/modules/mcp/components/mcp-connect-card";
import { MotivationSettingsCard } from "@/modules/motivation/components/motivation-settings";
import { ProfileForm } from "@/modules/profile/components/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" />
      <div className="flex flex-col gap-4">
        <GoalsSection />
        <MotivationSettingsCard />
        <ProfileForm />
        <McpConnectCard />
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" className="w-full">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </form>
      </div>
    </>
  );
}

import { Suspense } from "react";
import { ClientOnly } from "@/components/client-only";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Skeleton } from "@/components/ui/card";

function PageFallback() {
  return (
    <div className="flex flex-col gap-3 pt-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-lg px-4 pb-28">
        <Suspense fallback={<PageFallback />}>
          <ClientOnly fallback={<PageFallback />}>{children}</ClientOnly>
        </Suspense>
      </main>
      {/* The nav reads the URL, which is only known at request time. */}
      <Suspense fallback={<div className="fixed inset-x-0 bottom-0 h-16 border-t border-border bg-background" />}>
        <BottomNav />
      </Suspense>
    </>
  );
}

import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="h-10 w-10 text-muted" />
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="text-sm text-muted">Reconnect to sync your workouts and food. Pages you opened recently still work.</p>
    </main>
  );
}

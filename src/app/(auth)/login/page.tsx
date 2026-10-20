import { Dumbbell } from "lucide-react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Dumbbell className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Grind</h1>
        <p className="text-sm text-muted">Workouts, food and body composition — tracked, with an AI coach.</p>
      </div>
      <LoginForm />
    </main>
  );
}

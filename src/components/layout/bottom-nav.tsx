"use client";

import { Activity, Apple, Dumbbell, Home, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/workouts", label: "Workout", icon: Dumbbell },
  { href: "/nutrition", label: "Food", icon: Apple },
  { href: "/body", label: "Body", icon: Activity },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-lg">
      <ul className="mx-auto flex max-w-lg justify-around px-2 pt-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex w-16 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-medium transition",
                  active ? "text-accent" : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pt-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

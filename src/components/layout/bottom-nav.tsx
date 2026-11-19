"use client";

import { Activity, Apple, Dumbbell, Home, MessageCircle, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/workouts", label: "Workout", icon: Dumbbell },
  { href: "/nutrition", label: "Food", icon: Apple },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/body", label: "Body", icon: Activity },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-lg justify-between px-3 pt-1.5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-0.5 py-1 text-[10.5px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-all",
                    active ? "bg-accent text-accent-foreground" : "group-active:scale-90",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
                </span>
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
    <header className="flex items-end justify-between gap-3 pt-7 pb-5">
      <div className="min-w-0">
        <h1 className="truncate text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

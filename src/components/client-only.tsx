"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/**
 * Renders `children` only in the browser. App screens depend on the user's
 * local date/timezone and private data, so server-rendering them would only
 * produce mismatched dates and empty shells.
 */
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  return isClient ? children : fallback;
}

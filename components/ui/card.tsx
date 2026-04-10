import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--line-soft)] bg-white shadow-[var(--shadow-card)] transition-all duration-300",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("p-5", className)}>
      {children}
    </div>
  );
}

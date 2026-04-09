import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-[var(--line-soft)] bg-white shadow-[var(--shadow-card)] transition-all duration-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

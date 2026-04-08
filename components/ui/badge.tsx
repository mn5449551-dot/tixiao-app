import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "neutral",
}: PropsWithChildren<{ className?: string; tone?: "neutral" | "brand" | "success" | "warning" }>) {
  const toneClass = {
    neutral: "bg-[var(--surface-2)] text-[var(--ink-700)]",
    brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
    success: "bg-[var(--success-soft)] text-[var(--success-700)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning-700)]",
  }[tone];

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", toneClass, className)}>
      {children}
    </span>
  );
}

import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "neutral",
  size = "md",
}: PropsWithChildren<{ 
  className?: string; 
  tone?: "neutral" | "brand" | "success" | "warning";
  size?: "sm" | "md";
}>) {
  const toneClass = {
    neutral: "bg-[var(--surface-2)] text-[var(--ink-700)]",
    brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
    success: "bg-[var(--success-soft)] text-[var(--success-700)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning-700)]",
  }[tone];

  const sizeClass = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  }[size];

  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium transition-colors",
      toneClass,
      sizeClass,
      className
    )}>
      {children}
    </span>
  );
}

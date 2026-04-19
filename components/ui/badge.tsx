import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "neutral",
  size = "md",
}: PropsWithChildren<{
  className?: string;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
}>) {
  const toneClass = {
    neutral: "bg-[var(--surface-dim)] text-[var(--ink-subtle)]",
    brand: "bg-[var(--brand-bg)] text-[var(--brand-dark)]",
    success: "bg-[var(--success-bg)] text-[var(--success-text)]",
    warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
    danger: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
    info: "bg-[var(--info-soft)] text-[var(--info-700)]",
  }[tone];

  const sizeClass = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-0.5 text-xs",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-colors",
        toneClass,
        sizeClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

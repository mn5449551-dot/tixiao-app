import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SpinnerProps = HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg";
};

export function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  const sizeClass = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }[size];

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent",
        sizeClass,
        className,
      )}
      {...props}
    />
  );
}

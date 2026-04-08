import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
  }
>;

const variantClassMap: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--brand-500)] text-white shadow-[0_10px_30px_rgba(242,110,36,0.28)] hover:bg-[var(--brand-600)]",
  secondary:
    "bg-white text-[var(--ink-900)] ring-1 ring-[var(--line-soft)] hover:bg-[var(--surface-2)]",
  ghost: "bg-transparent text-[var(--ink-700)] hover:bg-[var(--surface-2)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger-700)] hover:bg-[var(--danger-soft-hover)]",
};

export function Button({
  children,
  className,
  disabled,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variantClassMap[variant],
        className,
      )}
      disabled={disabled}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

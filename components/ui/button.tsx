import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
  }
>;

const variantClassMap: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--brand-500)] text-white shadow-[0_10px_30px_rgba(242,110,36,0.28)] hover:bg-[var(--brand-600)] hover:shadow-[0_14px_40px_rgba(242,110,36,0.35)] active:scale-[0.97]",
  secondary:
    "bg-white text-[var(--ink-900)] ring-1 ring-[var(--line-soft)] hover:bg-[var(--surface-2)] hover:ring-[var(--brand-300)] active:scale-[0.97]",
  ghost: "bg-transparent text-[var(--ink-700)] hover:bg-[var(--surface-2)] active:scale-[0.97]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger-700)] hover:bg-[var(--danger-soft-hover)] active:scale-[0.97]",
};

const sizeClassMap: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs rounded-xl",
  md: "h-10 px-4 text-sm rounded-2xl",
  lg: "h-12 px-6 text-base rounded-2xl",
};

export function Button({
  children,
  className,
  disabled,
  type = "button",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "nodrag nopan inline-flex items-center justify-center font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none",
        variantClassMap[variant],
        sizeClassMap[size],
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

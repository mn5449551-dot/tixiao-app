import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
  }
>;

const variantClassMap: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-gradient-to-br from-[var(--brand-400)] to-[var(--brand-500)] text-white shadow-[0_4px_16px_rgba(232,131,90,0.2)] hover:shadow-[0_8px_24px_rgba(232,131,90,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]",
  secondary:
    "bg-white text-[var(--ink-800)] ring-1 ring-[var(--line-medium)] hover:bg-[var(--surface-1)] hover:ring-[var(--brand-300)] hover:text-[var(--ink-900)] active:scale-[0.97]",
  ghost: "bg-transparent text-[var(--ink-600)] hover:bg-[var(--surface-1)] hover:text-[var(--ink-800)] active:scale-[0.97]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger-700)] hover:bg-[var(--danger-soft-hover)] hover:-translate-y-0.5 active:scale-[0.97]",
};

const sizeClassMap: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs rounded-xl",
  md: "h-10 px-5 text-sm rounded-2xl",
  lg: "h-12 px-7 text-base rounded-2xl font-medium",
};

export function Button({
  children,
  className,
  disabled,
  isLoading,
  type = "button",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const effectiveDisabled = disabled || isLoading;

  return (
    <button
      className={cn(
        "nodrag nopan inline-flex items-center justify-center font-medium transition-all duration-300 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-y-0",
        variantClassMap[variant],
        sizeClassMap[size],
        className,
      )}
      disabled={effectiveDisabled}
      type={type}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

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
    "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] active:scale-[0.97]",
  secondary:
    "bg-[var(--surface)] text-[var(--ink-default)] ring-1 ring-[var(--border-strong)] hover:ring-[var(--brand-light)] hover:text-[var(--ink-strong)] active:scale-[0.97]",
  ghost:
    "bg-transparent text-[var(--ink-subtle)] hover:bg-[var(--surface-dim)] hover:text-[var(--ink-default)] active:scale-[0.97]",
  danger:
    "bg-[var(--danger-bg)] text-[var(--danger-text)] hover:bg-[var(--danger-soft-hover)] active:scale-[0.97]",
};

const sizeClassMap: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs rounded-[var(--radius-md)]",
  md: "h-9 px-4 text-sm rounded-[var(--radius-md)]",
  lg: "h-11 px-5 text-base rounded-[var(--radius-md)]",
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
        "nodrag nopan inline-flex items-center justify-center font-medium transition-all duration-[var(--duration-fast)] ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
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

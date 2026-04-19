"use client";

import type {
  InputHTMLAttributes,
  PropsWithChildren,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useCallback, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function Field({ label, hint, children }: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="flex flex-col gap-2 text-sm text-[var(--ink-default)]">
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--ink-strong)]">{label}</span>
        {hint ? <span className="text-xs text-[var(--ink-subtle)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputControlClassName, props.className)} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(inputControlClassName, "pr-8 appearance-none")} {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-disabled)]">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
  maxRows?: number;
};

export function Textarea({
  className,
  minRows = 3,
  maxRows = 6,
  onInput,
  value,
  ...props
}: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    element.style.height = "0px";
    const scrollHeight = element.scrollHeight;
    const lineHeight = parseInt(getComputedStyle(element).lineHeight || "20");
    const maxHeight = maxRows * lineHeight;
    element.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [maxRows]);

  useLayoutEffect(() => {
    resize();
  }, [resize, value]);

  return (
    <textarea
      {...props}
      ref={ref}
      rows={minRows}
      value={value}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      className={cn(textareaControlClassName, className)}
    />
  );
}

const inputControlClassName =
  "nodrag nopan h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm text-[var(--ink-default)] outline-none transition-all duration-[var(--duration-fast)] placeholder:text-[var(--ink-disabled)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] disabled:cursor-not-allowed disabled:bg-[var(--surface-dim)]";

const textareaControlClassName =
  "nodrag nopan min-h-10 w-full resize-none overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink-default)] outline-none transition-all duration-[var(--duration-fast)] placeholder:text-[var(--ink-disabled)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] disabled:cursor-not-allowed disabled:bg-[var(--surface-dim)]";

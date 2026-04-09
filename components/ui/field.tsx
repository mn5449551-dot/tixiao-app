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
    <label className="flex flex-col gap-1.5 text-sm text-[var(--ink-700)]">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-[var(--ink-900)]">{label}</span>
        {hint ? <span className="text-[11px] text-[var(--ink-500)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputControlClassName} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputControlClassName} {...props} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
};

export function Textarea({
  className,
  minRows = 3,
  onInput,
  value,
  ...props
}: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

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
  "nodrag nopan h-10 w-full rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 text-sm text-[var(--ink-900)] outline-none transition-all duration-150 placeholder:text-[var(--ink-400)] focus:border-[var(--brand-400)] focus:ring-4 focus:ring-[var(--brand-ring)] disabled:cursor-not-allowed disabled:bg-[var(--surface-1)]";

const textareaControlClassName =
  "nodrag nopan min-h-10 w-full resize-none overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-0)] px-3 py-2.5 text-sm text-[var(--ink-900)] outline-none transition-all duration-150 placeholder:text-[var(--ink-400)] focus:border-[var(--brand-400)] focus:ring-4 focus:ring-[var(--brand-ring)] disabled:cursor-not-allowed disabled:bg-[var(--surface-1)]";

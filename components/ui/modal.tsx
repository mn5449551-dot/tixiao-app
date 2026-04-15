"use client";

import { useEffect, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";

export function Modal({
  children,
  description,
  isOpen,
  onClose,
  scrollable = false,
  title,
}: PropsWithChildren<{
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  scrollable?: boolean;
  title: string;
}>) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[rgba(28,25,23,0.42)] backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-xl rounded-[28px] border border-[var(--line-soft)] bg-[var(--surface-0)] p-6 shadow-[var(--shadow-elevated)]${scrollable ? " max-h-[85vh]" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2">
          <h2 id="modal-title" className="text-2xl font-semibold text-[var(--ink-950)]">
            {title}
          </h2>
          {description ? <p className="text-sm leading-7 text-[var(--ink-600)]">{description}</p> : null}
        </div>
        <div className={scrollable ? "mt-5 max-h-[70vh] overflow-y-auto pr-1" : "mt-5"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

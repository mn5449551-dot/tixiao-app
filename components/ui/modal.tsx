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
      <div className="absolute inset-0 bg-[rgba(28,25,23,0.4)]" />
      <div
        className={`relative w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]${scrollable ? " max-h-[85vh]" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 id="modal-title" className="text-xl font-semibold text-[var(--ink-strong)]">
            {title}
          </h2>
          {description ? <p className="text-sm leading-relaxed text-[var(--ink-subtle)]">{description}</p> : null}
        </div>
        <div className={scrollable ? "mt-5 max-h-[70vh] overflow-y-auto pr-1" : "mt-5"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

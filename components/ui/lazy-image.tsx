"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Shared observer — one instance for all LazyImage components
let sharedObserver: IntersectionObserver | null = null;
function getSharedObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const callback = (entry.target as HTMLElement & { _lazyVisible?: () => void })._lazyVisible;
            if (callback) {
              callback();
              sharedObserver?.unobserve(entry.target);
            }
          }
        }
      },
      { rootMargin: "300px" },
    );
  }
  return sharedObserver;
}

export function LazyImage({
  ...props
}: React.ComponentProps<typeof Image>) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = getSharedObserver();
    (el as HTMLElement & { _lazyVisible?: () => void })._lazyVisible = () => setIsVisible(true);
    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

  return (
    <div
      ref={ref}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {isVisible ? (
        <Image {...props} />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--surface-2, #f5f0eb)",
            borderRadius: "inherit",
          }}
        />
      )}
    </div>
  );
}

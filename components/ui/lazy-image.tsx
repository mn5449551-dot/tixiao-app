"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Lazy-loaded wrapper around Next.js <Image>.
 * Uses IntersectionObserver to defer loading until the element is near
 * the viewport (rootMargin 300px). Once visible, the image stays loaded
 * so repeated scroll in/out doesn't cause flicker.
 */
export function LazyImage({
  ...props
}: React.ComponentProps<typeof Image>) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
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

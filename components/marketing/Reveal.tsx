"use client";

import { useEffect, useRef } from "react";

/**
 * Fade/rise-in-on-scroll wrapper for marketing sections.
 *
 * Only animates elements that start below the fold, and no-ops entirely under
 * prefers-reduced-motion. A safety timeout guarantees content is shown even if
 * the observer never fires.
 */
export default function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const vh = window.innerHeight || 800;
    // Already in view on load — leave it alone (no flash).
    if (el.getBoundingClientRect().top <= vh * 0.92) return;

    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = `opacity 640ms cubic-bezier(.2,.7,.2,1) ${delay}ms, transform 640ms cubic-bezier(.2,.7,.2,1) ${delay}ms`;

    const show = () => {
      el.style.opacity = "1";
      el.style.transform = "none";
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show();
            io.disconnect();
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );
    io.observe(el);
    const safety = window.setTimeout(show, 2000 + delay);

    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

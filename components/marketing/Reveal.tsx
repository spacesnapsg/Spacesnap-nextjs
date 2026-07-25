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
  distance = 44,
  duration = 760,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const vh = window.innerHeight || 800;
    // Already in view on load — leave it alone (no flash).
    if (el.getBoundingClientRect().top <= vh * 0.92) return;

    const ease = "cubic-bezier(.16,.84,.44,1)";
    el.style.opacity = "0";
    el.style.transform = `translateY(${distance}px)`;
    el.style.willChange = "opacity, transform";
    el.style.transition = `opacity ${duration}ms ${ease} ${delay}ms, transform ${duration}ms ${ease} ${delay}ms`;

    const show = () => {
      el.style.opacity = "1";
      el.style.transform = "none";
      window.setTimeout(() => {
        el.style.willChange = "auto";
      }, duration + delay);
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
  }, [delay, distance, duration]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

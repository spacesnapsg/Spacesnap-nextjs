"use client";

import { useEffect, useRef, useState } from "react";

interface StickyBlurRevealProps {
  text: string;
  className?: string;
  /** Scroll distance in px over which the text goes from fully blurred to
   * fully revealed. Independent of viewport height (see note below). */
  revealDistance?: number;
  initialBlur?: number;
  initialOpacity?: number;
  /** Classes for the sticky viewport-height container — controls where the
   * text sits vertically (e.g. "items-center" vs "items-start pt-40"). */
  wrapperClassName?: string;
}

// Ported from a Framer code component (StickyBlurReveal.tsx) used on the
// original spacesnap.framer.website landing page: words blur/fade in one by
// one as the sticky text scrolls through `revealDistance` px. Framer's
// `addPropertyControls`/`RenderTarget` (editor-only APIs) are dropped since
// they don't exist outside Framer.
//
// The outer spacer is `100vh + revealDistance` tall (not a fixed px value)
// so the sticky child always has exactly `revealDistance` of scroll room to
// pin within, regardless of viewport height — a fixed spacer height (the
// original Framer port's approach) breaks on any screen taller than that
// fixed value, since the sticky child then has zero/negative room to pin in
// and the words never finish unblurring.
export default function StickyBlurReveal({
  text,
  className = "",
  revealDistance = 500,
  initialBlur = 6,
  initialOpacity = 0.15,
  wrapperClassName = "items-center",
}: StickyBlurRevealProps) {
  const stickyRef = useRef<HTMLDivElement>(null);
  const words = text.split(" ");
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const sticky = stickyRef.current;
    if (!sticky) return;

    let startScrollY = 0;

    const handleScroll = () => {
      const progress = (window.scrollY - startScrollY) / revealDistance;
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const rect = entry.boundingClientRect;
          startScrollY = window.scrollY + rect.top;
          handleScroll();
          window.addEventListener("scroll", handleScroll, { passive: true });
        } else {
          window.removeEventListener("scroll", handleScroll);
        }
      },
      { threshold: [0] }
    );

    observer.observe(sticky);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [revealDistance]);

  return (
    <div style={{ height: `calc(100vh + ${revealDistance}px)` }}>
      <div
        ref={stickyRef}
        className={`sticky top-0 flex justify-center px-6 ${wrapperClassName}`}
        style={{ height: "100vh" }}
      >
        <p className={className}>
          {words.map((word, index) => {
            const wordProgress =
              (scrollProgress - index / words.length) * words.length;
            const progress = Math.max(0, Math.min(1, wordProgress));
            const blurAmount = initialBlur * (1 - progress);
            const opacity = initialOpacity + (1 - initialOpacity) * progress;
            return (
              <span
                key={index}
                className="inline-block mr-[0.25em]"
                style={{
                  filter: `blur(${blurAmount}px)`,
                  opacity,
                  transition: "filter 0.2s ease-out, opacity 0.2s ease-out",
                }}
              >
                {word}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}

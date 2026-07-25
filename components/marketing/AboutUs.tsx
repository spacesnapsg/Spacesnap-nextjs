"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * About Us marketing page — founder origin story.
 *
 * Ported from the Claude Design project "Spacesnap marketplace features page"
 * (`About Us.dc.html`), imported via the design MCP. The source already used
 * SpaceSnap's real teal (#4db8b0/#1a9d96) and supplier-purple
 * (#9333ea/#6b21a8, see tailwind.config.ts) tokens on the site's own #0a0e14
 * background, so no re-skin was needed — unlike the Marketplace Features /
 * Digital Passport ports. Dropped the source's full-page dot-grid + top
 * grid-line texture (kept only the ambient glow blobs) to match the landing
 * page's (app/page.tsx) hero styling, same precedent as the other two
 * marketing sub-pages. Kept the source's scroll-progress bar and the
 * scroll-triggered door-opening SVG animation, translated from its DC-runtime
 * script into a plain useEffect. Mirrors the MarketplaceFeatures.tsx /
 * DigitalPassport.tsx conventions.
 */

const ACCENT = "#4db8b0";
const ACCENT_DEEP = "#1a9d96";
const SANS = "var(--font-geist-sans), Helvetica, Arial, sans-serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
// accent as bare rgb channels, for rgba(..., alpha) tints
const A = "77,184,176";
const A_DEEP = "26,157,150";
// body text as bare channels (design's #e6edf3)
const T = "230,237,243";

export default function AboutUs() {
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Scroll-reveal: elements starting below the fold fade/rise in on intersect.
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    const show = (el: HTMLElement) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    };

    let io: IntersectionObserver | undefined;
    let safety: number | undefined;

    if (reduce) {
      nodes.forEach(show);
    } else {
      const vh = window.innerHeight || 800;
      const pending = nodes.filter(
        (el) => el.getBoundingClientRect().top > vh * 0.9
      );
      pending.forEach((el) => {
        el.style.opacity = "0";
        el.style.transform = "translateY(24px)";
        el.style.transition =
          "opacity 800ms cubic-bezier(.2,.7,.2,1), transform 800ms cubic-bezier(.2,.7,.2,1)";
      });
      if (pending.length) {
        io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                show(e.target as HTMLElement);
                io?.unobserve(e.target);
              }
            });
          },
          { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
        );
        pending.forEach((n) => io?.observe(n));
        safety = window.setTimeout(() => pending.forEach(show), 2400);
      }
    }

    // Scroll-progress bar.
    const bar = document.querySelector<HTMLElement>("[data-progress]");
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) {
        bar.style.width =
          (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + "%";
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Door-opens-on-scroll animation ("What we built" section).
    let doorIO: IntersectionObserver | undefined;
    const panel = document.querySelector<SVGGElement>("[data-door-panel]");
    const beam = document.querySelector<SVGPathElement>("[data-key-beam]");
    const lock = document.querySelector<SVGCircleElement>("[data-door-lock]");
    if (panel && !reduce) {
      doorIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              panel.style.transform = "perspective(700px) rotateY(-58deg)";
              if (beam) beam.style.opacity = "1";
              if (lock) lock.style.stroke = "rgba(77,184,176,0.25)";
              doorIO?.unobserve(e.target);
            }
          });
        },
        { threshold: 0.55 }
      );
      doorIO.observe(panel.closest("svg") ?? panel);
    }

    return () => {
      io?.disconnect();
      doorIO?.disconnect();
      if (safety) window.clearTimeout(safety);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <main
      style={{
        position: "relative",
        background: "#0a0e14",
        color: `#e6edf3`,
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      {/* Scroll-progress bar */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `rgba(${T},0.06)`,
          zIndex: 50,
        }}
      >
        <div
          data-progress
          style={{
            height: "100%",
            width: "0%",
            background: `linear-gradient(90deg, ${ACCENT_DEEP}, ${ACCENT})`,
            boxShadow: `0 0 12px rgba(${A},0.7)`,
          }}
        />
      </div>

      {/* Hero */}
      <section
        className="au-hero"
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 44,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "12%",
            left: "50%",
            width: 780,
            height: 780,
            marginLeft: -390,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${A_DEEP},0.16), rgba(${A_DEEP},0.04) 45%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
        <svg
          data-reveal
          viewBox="0 0 120 130"
          width="132"
          height="143"
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: "relative",
            filter: `drop-shadow(0 0 8px rgba(${A},0.55))`,
          }}
        >
          <circle cx="60" cy="44" r="24" />
          <path d="M36 40c2-18 46-18 48 0" stroke={`rgba(${A},0.75)`} />
          <path d="M50 46h4M66 46h4" />
          <path d="M56 58c3 2 5 2 8 0" />
          <path d="M52 66v8c0 3-3 5-6 6M68 66v8c0 3 3 5 6 6" />
          <path d="M22 128c0-24 14-38 38-38s38 14 38 38" />
          <path d="M60 90v14" stroke={`rgba(${A},0.5)`} />
          <circle cx="60" cy="44" r="34" stroke={`rgba(${A},0.2)`} />
        </svg>
        <div
          style={{
            position: "relative",
            maxWidth: "30ch",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <h1
            data-reveal
            className="au-h1"
            style={{
              lineHeight: 1.1,
              letterSpacing: "-0.035em",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Hi, I&apos;m Rei.
          </h1>
          <p
            data-reveal
            className="au-lede"
            style={{
              lineHeight: 1.5,
              color: `rgba(${T},0.62)`,
              margin: 0,
              textWrap: "pretty",
            }}
          >
            Before SpaceSnap existed, I stood on both sides of a locked door.
          </p>
        </div>
        <div
          className="au-scroll-hint"
          style={{
            position: "relative",
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: `rgba(${T},0.32)`,
          }}
        >
          Scroll
        </div>
      </section>

      {/* 2019 */}
      <section className="au-story au-pad">
        <div data-reveal className="au-story-visual">
          <svg
            viewBox="0 0 320 260"
            width="100%"
            style={{
              maxWidth: 420,
              filter: `drop-shadow(0 0 8px rgba(${A},0.4))`,
            }}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect
              x="150"
              y="24"
              width="150"
              height="212"
              rx="4"
              stroke={`rgba(${A},0.45)`}
            />
            <path
              d="M168 24v212M186 24v212M204 24v212M222 24v212M240 24v212M258 24v212M276 24v212"
              stroke={`rgba(${A},0.22)`}
            />
            <rect x="186" y="70" width="82" height="118" rx="3" />
            <circle cx="212" cy="102" r="12" />
            <circle cx="212" cy="102" r="3" fill={ACCENT} stroke="none" />
            <path d="M196 132h62M196 144h44M196 156h52" />
            <rect
              x="198"
              y="52"
              width="58"
              height="9"
              rx="4"
              stroke={`rgba(${A},0.5)`}
            />
            <circle cx="52" cy="120" r="13" />
            <path d="M52 133v52M34 152h36M42 216l10-31 10 31" />
            <path
              d="M96 40v180"
              stroke={`rgba(${A},0.3)`}
              strokeDasharray="5 7"
            />
          </svg>
        </div>
        <div className="au-story-copy">
          <span data-reveal className="au-label">
            2019
          </span>
          <p data-reveal className="au-p-lg">
            I founded my first startup. I learned fast that the hardest part
            of a good idea isn&apos;t the idea — it&apos;s the cost of
            proving it.
          </p>
          <p data-reveal className="au-p-md">
            The equipment I needed sat behind huge price tags and spaces
            expect multi-year memberships. It was tough in ways I
            didn&apos;t expect.
          </p>
        </div>
      </section>

      {/* Crossing over */}
      <section className="au-story au-pad">
        <div data-reveal className="au-story-visual">
          <svg
            viewBox="0 0 320 260"
            width="100%"
            style={{
              maxWidth: 420,
              filter: `drop-shadow(0 0 8px rgba(${A},0.4))`,
            }}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect
              x="20"
              y="24"
              width="150"
              height="212"
              rx="4"
              stroke={`rgba(${A},0.45)`}
            />
            <path
              d="M38 24v212M56 24v212M74 24v212M92 24v212M110 24v212M128 24v212M146 24v212"
              stroke={`rgba(${A},0.22)`}
            />
            <path
              d="M170 130h70"
              stroke={`rgba(${A},0.35)`}
              strokeDasharray="5 7"
            />
            <circle cx="268" cy="120" r="13" />
            <path d="M268 133v52M250 152h36M258 216l10-31 10 31" />
            <rect
              x="46"
              y="86"
              width="76"
              height="88"
              rx="3"
              stroke={`rgba(${A},0.55)`}
            />
            <path d="M56 104h56M56 118h38M56 132h48" />
            <circle cx="84" cy="156" r="8" />
          </svg>
        </div>
        <div className="au-story-copy">
          <span data-reveal className="au-label">
            Crossing over
          </span>
          <p data-reveal className="au-p-lg">
            Then I crossed to the other side of the table — into
            Singapore&apos;s incubation scene.
          </p>
          <p data-reveal className="au-p-md">
            For five years, I built and ran the very infrastructure I&apos;d
            once been locked out of.
          </p>
        </div>
      </section>

      {/* Both sides losing */}
      <section className="au-story au-pad">
        <div data-reveal className="au-story-visual">
          <svg
            viewBox="0 0 340 260"
            width="100%"
            style={{
              maxWidth: 440,
              filter: `drop-shadow(0 0 8px rgba(${A},0.4))`,
            }}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M170 16v228"
              stroke={`rgba(${A},0.3)`}
              strokeDasharray="4 8"
            />
            <circle cx="66" cy="112" r="13" />
            <path d="M66 125v50M48 142h36M56 214l10-31 10 31" />
            <path d="M118 96l14 14-14 14" stroke={`rgba(${A},0.5)`} />
            <rect
              x="212"
              y="42"
              width="102"
              height="176"
              rx="4"
              stroke={`rgba(${A},0.45)`}
            />
            <path d="M226 42v176" stroke={`rgba(${A},0.3)`} />
            <rect x="238" y="60" width="62" height="140" rx="3" />
            <circle cx="250" cy="132" r="4" />
            <path d="M206 96l-14 14 14 14" stroke={`rgba(${A},0.5)`} />
          </svg>
        </div>
        <div className="au-story-copy">
          <span data-reveal className="au-label">
            Both sides losing
          </span>
          <p data-reveal className="au-p-lg">
            And I watched the same story from the other direction.
          </p>
          <p data-reveal className="au-p-md">
            Operators turning away startups — not because they wanted to, but
            because one unverified user is a liability they can&apos;t price.
            Founders walking away from access they couldn&apos;t afford. Both
            sides kept losing.
          </p>
        </div>
      </section>

      {/* None of this is anyone's fault */}
      <section className="au-neutral au-pad">
        <div data-reveal className="au-icons-row">
          <svg
            viewBox="0 0 90 90"
            width="104"
            height="104"
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 7px rgba(${A},0.45))` }}
          >
            <rect x="22" y="16" width="46" height="58" rx="3" />
            <rect
              x="16"
              y="10"
              width="46"
              height="58"
              rx="3"
              stroke={`rgba(${A},0.4)`}
            />
            <path d="M32 34h26M32 44h26M32 54h16" />
          </svg>
          <svg
            viewBox="0 0 90 90"
            width="104"
            height="104"
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 7px rgba(${A},0.45))` }}
          >
            <path d="M45 10l28 10v26c0 18-13 29-28 34-15-5-28-16-28-34V20z" />
            <path d="M45 22l-7 20h13l-8 22" stroke={`rgba(${A},0.75)`} />
          </svg>
          <svg
            viewBox="0 0 90 90"
            width="104"
            height="104"
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 7px rgba(${A},0.45))` }}
          >
            <rect x="14" y="20" width="62" height="54" rx="4" />
            <path d="M14 36h62M28 12v14M62 12v14" />
            <circle cx="45" cy="54" r="9" stroke={`rgba(${A},0.8)`} />
            <path d="M45 45v-6M36 62l-8 8M54 62l8 8" />
          </svg>
          <svg
            viewBox="0 0 90 90"
            width="104"
            height="104"
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 7px rgba(${A},0.45))` }}
          >
            <circle cx="45" cy="58" r="21" />
            <circle cx="45" cy="58" r="15" stroke={`rgba(${A},0.45)`} />
            <path
              d="M45 48v20M50 52c-2-2-10-2-10 3s10 3 10 8-8 5-10 3"
              stroke={`rgba(${A},0.85)`}
            />
            <path
              d="M45 33c0-7-5-10-5-16 12 4 16 11 16 16"
              stroke={`rgba(${A},0.7)`}
            />
            <path
              d="M45 33c-4-3-9-4-11-9-3 5-3 9-1 12"
              stroke={`rgba(${A},0.45)`}
            />
          </svg>
        </div>
        <div className="au-neutral-copy">
          <p data-reveal className="au-p-lg">
            None of this is anyone&apos;s fault.
          </p>
          <p data-reveal className="au-p-md">
            A membership is how an operator buys safety: one vetted tenant
            instead of forty strangers. One contract instead of endless
            paperwork. Steady revenue instead of a lumpy trickle.
          </p>
          <p
            data-reveal
            className="au-p-lg"
            style={{ color: ACCENT, margin: 0 }}
          >
            Every fear is rational — and every fear points the same way.
            Sell years, not sessions.
          </p>
        </div>
      </section>

      {/* The realization */}
      <section className="au-story au-pad">
        <div data-reveal className="au-story-visual">
          <svg
            viewBox="0 0 340 300"
            width="100%"
            style={{
              maxWidth: 430,
              filter: `drop-shadow(0 0 9px rgba(${A},0.45))`,
            }}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g stroke={`rgba(${A},0.4)`} transform="translate(24,20) scale(0.42)">
              <rect x="22" y="16" width="46" height="58" rx="3" />
              <path d="M32 34h26M32 44h26" />
            </g>
            <g stroke={`rgba(${A},0.4)`} transform="translate(250,20) scale(0.42)">
              <path d="M45 10l28 10v26c0 18-13 29-28 34-15-5-28-16-28-34V20z" />
              <path d="M45 22l-7 20h13l-8 22" />
            </g>
            <g stroke={`rgba(${A},0.4)`} transform="translate(24,222) scale(0.42)">
              <rect x="14" y="20" width="62" height="54" rx="4" />
              <path d="M14 36h62M28 12v14M62 12v14" />
              <circle cx="45" cy="54" r="9" />
            </g>
            <g stroke={`rgba(${A},0.4)`} transform="translate(250,222) scale(0.42)">
              <circle cx="45" cy="58" r="21" />
              <circle cx="45" cy="58" r="15" />
              <path d="M50 52c-2-2-10-2-10 3s10 3 10 8-8 5-10 3M45 48v20" />
            </g>
            <path
              d="M66 54l58 62M292 54l-56 62M66 258l58-62M292 258l-56-62"
              stroke={`rgba(${A},0.28)`}
              strokeDasharray="4 6"
            />
            <rect x="112" y="106" width="116" height="88" rx="8" />
            <path d="M112 128h116" stroke={`rgba(${A},0.55)`} />
            <circle cx="140" cy="156" r="12" />
            <path d="M162 150h48M162 164h34" />
            <path d="M124 118h18" stroke={`rgba(${A},0.7)`} />
          </svg>
        </div>
        <div className="au-story-copy">
          <span data-reveal className="au-label">
            The realization
          </span>
          <p data-reveal className="au-p-lg">
            The missing piece was never space. Singapore has world-class
            facilities sitting idle — and founders who need them going
            without.
          </p>
          <p data-reveal className="au-p-md">
            It was a frozen market: demand too scattered for any one
            operator to serve, supply too rigid for any founder to use.
            Each side waiting for the other to move first.
          </p>
        </div>
      </section>

      {/* What we built */}
      <section className="au-story au-pad" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "20%",
            width: 760,
            height: 760,
            marginTop: -380,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${A_DEEP},0.2), rgba(${A_DEEP},0.05) 45%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
        <div data-reveal className="au-story-visual" style={{ position: "relative" }}>
          <svg
            viewBox="0 0 340 280"
            width="100%"
            style={{
              maxWidth: 460,
              filter: `drop-shadow(0 0 12px rgba(${A},0.6))`,
            }}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect
              x="182"
              y="24"
              width="150"
              height="232"
              rx="4"
              stroke={`rgba(${A},0.5)`}
            />
            <g
              data-door-panel
              style={{
                transformOrigin: "194px 140px",
                transform: "rotateY(0deg)",
                transition: "transform 1100ms cubic-bezier(.3,.7,.2,1)",
              }}
            >
              <rect x="194" y="34" width="128" height="212" rx="3" />
              <path
                d="M212 34v212M230 34v212M248 34v212M266 34v212M284 34v212M302 34v212"
                stroke={`rgba(${A},0.22)`}
              />
              <circle
                data-door-lock
                cx="304"
                cy="140"
                r="6"
                stroke={`rgba(${A},0.9)`}
                style={{ transition: "stroke 700ms ease" }}
              />
            </g>
            <rect x="14" y="86" width="118" height="82" rx="8" />
            <path d="M14 106h118" stroke={`rgba(${A},0.55)`} />
            <circle cx="42" cy="136" r="11" />
            <path d="M62 130h50M62 144h34" />
            <path
              data-key-beam
              d="M132 128h44"
              stroke={`rgba(${A},0.85)`}
              strokeDasharray="5 6"
              style={{ opacity: 0.5, transition: "opacity 700ms ease" }}
            />
            <path d="M150 122l8 6-8 6" stroke={`rgba(${A},0.7)`} />
          </svg>
        </div>
        <div className="au-story-copy" style={{ position: "relative" }}>
          <span data-reveal className="au-label">
            What we built
          </span>
          <p
            data-reveal
            className="au-p-built"
            style={{ color: "#e6edf3", margin: 0 }}
          >
            So we built the layer that lets both sides move: the Digital
            Passport.
          </p>
          <p data-reveal className="au-p-md">
            Operators list idle hours at no risk and no admin — verification,
            compliance and access run themselves. Founders carry it across
            every facility: prove yourself once, book the session, not the
            year. The door — literally — unlocks.
          </p>
        </div>
      </section>

      {/* Closing / CTA */}
      <section className="au-close au-pad">
        <div data-reveal style={{ display: "flex", justifyContent: "center" }}>
          <svg
            viewBox="0 0 400 200"
            width="100%"
            style={{
              maxWidth: 560,
              filter: `drop-shadow(0 0 9px rgba(${A},0.45))`,
            }}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M92 118c14-22 44-34 78-34 30 0 52 6 76 4 22-2 40-8 52 4 10 10 4 28-14 38-24 14-60 22-104 22-42 0-72-8-86-18-8-6-8-12-2-16z"
              stroke={`rgba(${A},0.4)`}
            />
            <g stroke={`rgba(${A},0.35)`}>
              <path d="M136 122l38-18 40 12 44-14 38 10" />
              <path d="M174 104l16 26 24-16M254 102l-40 34" />
            </g>
            <circle cx="136" cy="122" r="5" fill={ACCENT} stroke="none" />
            <circle cx="174" cy="104" r="5" fill={ACCENT} stroke="none" />
            <circle cx="214" cy="116" r="5" fill={ACCENT} stroke="none" />
            <circle cx="258" cy="102" r="5" fill={ACCENT} stroke="none" />
            <circle cx="296" cy="112" r="5" fill={ACCENT} stroke="none" />
            <circle cx="190" cy="130" r="4" fill={`rgba(${A},0.6)`} stroke="none" />
            <circle cx="136" cy="122" r="12" stroke={`rgba(${A},0.28)`} />
            <circle cx="258" cy="102" r="12" stroke={`rgba(${A},0.28)`} />
          </svg>
        </div>
        <p
          data-reveal
          className="au-close-lede"
          style={{
            margin: 0,
            maxWidth: "44ch",
            color: `rgba(${T},0.82)`,
            textWrap: "pretty",
            textAlign: "center",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          We&apos;re building SpaceSnap in Singapore, starting with life
          sciences and food tech, alongside founding members and pilot
          facilities who are shaping it with us.
        </p>
        <div data-reveal className="au-cta-card">
          <h3 className="au-cta-h">Building something — or running a facility?</h3>
          <p className="au-cta-p">
            Get access to the facilities and equipment you need, or release your
            capacity to verified users without carrying the liability alone.
          </p>
          <Link
            href="/signup"
            className="au-cta-btn"
            style={{
              background: `linear-gradient(135deg, ${ACCENT_DEEP}, #9333ea, #6b21a8)`,
              color: "#ffffff",
            }}
          >
            Get Started
          </Link>
        </div>
      </section>
    </main>
  );
}

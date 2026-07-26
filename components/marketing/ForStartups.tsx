"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Solutions › For Startups marketing page.
 *
 * Ported from the Claude Design project "For Startups v2" (`For Startups
 * v2.dc.html`) — its content, layout and scroll-reveal motion, but re-skinned
 * onto SpaceSnap's own visual system (teal accent, site background, Geist
 * sans/mono) rather than the source's Inter look, and dropping the design's
 * own header/footer in favour of the shared marketing chrome
 * (MarketingNavbar/MarketingFooter). Mirrors the sibling
 * MarketplaceFeatures.tsx/DigitalPassport.tsx/ListAndFill.tsx conventions.
 *
 * Copy fact-check pass: dropped the source's fabricated "$500k instruments"
 * figure and reworded its "no lease" line per the no-"lease" marketing-copy
 * constraint (same pattern already applied on MarketplaceFeatures.tsx);
 * dropped its generic "24-month commitment" number in favour of an
 * unquantified claim; dropped the "Trusted facility partners" logo wall
 * (placeholder logos with no real partner roster to back them); and pointed
 * the "walk in cleared" feature at /platform/digital-passport instead of the
 * source's nonexistent /platform/check-in route (kiosk check-in is
 * physical-hardware-only per the Trust Architecture — there's no browser
 * page for it).
 */

// SpaceSnap brand tokens (mirrors tailwind.config.ts) — used inline because the
// design leans on rgba tints/glows that Tailwind utilities can't express.
const ACCENT = "#4db8b0"; // user-teal-end
const ACCENT_LIGHT = "#7fd4cd";
const ACCENT_DEEP = "#1a9d96"; // user-teal-start
const SANS = "var(--font-geist-sans), Helvetica, Arial, sans-serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
// accent as bare rgb channels, for rgba(... , alpha) tints
const A = "77,184,176";
// neutral text as bare channels
const T = "229,231,235";

const PROBLEMS = [
  {
    text: "A full lab fit-out costs more than your seed round.",
    icon: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
  },
  {
    text: "Long-term commitments lock you in before your science is proven.",
    icon: "M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z",
  },
  {
    text: "Every new facility restarts onboarding from zero.",
    icon: "M3 12a9 9 0 1015-6.7L21 8M21 3v5h-5",
  },
];

const FEATURES = [
  {
    eyebrow: "Book by the session",
    title: "Spend follows experiments, not floor area.",
    body: "Pay-as-you-go access to equipment and space. Take an instrument for a day, a cleanroom for a week, and stop when the run is done.",
    shot: "Marketplace booking flow",
    shotUrl:
      "https://pub-aee5a0705b5048b3bc38888dd602aeac.r2.dev/marketing/for-startups/booking-flow-v2.png",
  },
  {
    eyebrow: "One passport, every space",
    title: "Onboard once, work anywhere.",
    body: "Once you're verified competent, nothing's in your way. Your Digital Passport carries every sign-off across the network, so the next facility already knows you're cleared before you arrive.",
    shot: "Digital Passport credential view",
    shotUrl:
      "https://pub-aee5a0705b5048b3bc38888dd602aeac.r2.dev/marketing/for-startups/passport-card.png" as string | undefined,
  },
  {
    eyebrow: "Walk in cleared",
    title: "Once you're cleared, walk on in.",
    body: "Kiosk check-in verifies your credentials at the door. Quick, secure, fuss-free.",
    shot: "Kiosk check-in",
    shotUrl: undefined as string | undefined,
  },
];

// "The comparison" racecourse diagram — the three routes a founder actually
// weighs on the way to a first real experiment: build your own space (bigger
// capex, bigger companies), join an incubator (touring options, then
// paperwork and liability sign-off together, then moving logistics — all
// before you've even started), or book on SpaceSnap. All three lanes share
// one coordinate system so a single vertical marker can show how far apart
// they are at the same point in time.
type Pt = [number, number];
type CubicSeg = [Pt, Pt, Pt, Pt];

const TRACK_W = 1340;
const LANE_H = 280;
const LANE_GAP = 70;
const TRACK_H = LANE_H * 3 + LANE_GAP * 2;
const SNAP_LANE_Y = 0;
const INCUBATOR_LANE_Y = LANE_H + LANE_GAP;
const BUILD_LANE_Y = (LANE_H + LANE_GAP) * 2;
const INCUBATOR_ACCENT = "#d9a441";

const SEG_A: CubicSeg = [
  [40, 140],
  [300, 10],
  [500, 10],
  [700, 140],
];
const SEG_B: CubicSeg = [
  [700, 140],
  [900, 270],
  [1100, 270],
  [1300, 140],
];
// Where the incubator lane's route stops partway round the second bend —
// slower than SpaceSnap, faster than a from-scratch build.
const INCUBATOR_FINISH_T = 0.22;

function lerp(p: Pt, q: Pt, t: number): Pt {
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

function cubicPoint(seg: CubicSeg, t: number): Pt {
  const [p0, p1, p2, p3] = seg;
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

// De Casteljau split — returns the sub-curve's own control points so a
// partial run (e.g. the incubator lane stopping mid-bend) can be drawn with
// a normal SVG "C" command instead of the full segment.
function splitCubicLeft(seg: CubicSeg, t: number): CubicSeg {
  const [p0, p1, p2, p3] = seg;
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const f = lerp(d, e, t);
  return [p0, a, d, f];
}
function splitCubicRight(seg: CubicSeg, t: number): CubicSeg {
  const [p0, p1, p2, p3] = seg;
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const f = lerp(d, e, t);
  return [f, e, c, p3];
}

function segPath(seg: CubicSeg, offsetY: number, includeMove: boolean) {
  const [p0, p1, p2, p3] = seg;
  const f = ([x, y]: Pt) => `${x},${y + offsetY}`;
  return `${includeMove ? `M${f(p0)} ` : ""}C${f(p1)} ${f(p2)} ${f(p3)}`;
}

type Checkpoint = {
  seg: CubicSeg;
  t: number;
  label: string;
  time: string;
  pos: "above" | "below";
};

const SNAP_CHECKPOINTS: Checkpoint[] = [
  {
    seg: SEG_A,
    t: 0,
    label: "Sign up — verify or earn credentials",
    time: "Minutes to start",
    pos: "below",
  },
  { seg: SEG_A, t: 0.5, label: "Book a session", time: "Same day", pos: "below" },
];
const SNAP_FINISH: Checkpoint = {
  seg: SEG_A,
  t: 1,
  label: "First experiment",
  time: "Days, door to bench",
  pos: "below",
};
// Past the finish line, but still on the same lane: the only route with
// somewhere to keep your gear for next time.
const SNAP_AFTER_T = 0.38;
const SNAP_AFTER: Checkpoint = {
  seg: SEG_B,
  t: SNAP_AFTER_T,
  label: "Subscribe & store your gear",
  time: "For next time",
  pos: "above",
};

const INCUBATOR_CHECKPOINTS: Checkpoint[] = [
  {
    seg: SEG_A,
    t: 0,
    label: "Site visits — check out incubators",
    time: "1–3 wks",
    pos: "below",
  },
  {
    seg: SEG_A,
    t: 0.5,
    label: "Agreements — negotiate & sign off",
    time: "3–5 wks",
    pos: "below",
  },
  {
    seg: SEG_A,
    t: 0.85,
    label: "Moving logistics",
    time: "1–2 wks",
    pos: "below",
  },
];
const INCUBATOR_FINISH: Checkpoint = {
  seg: SEG_B,
  t: INCUBATOR_FINISH_T,
  label: "First experiment",
  time: "Weeks, if the gear fits",
  pos: "below",
};

const BUILD_CHECKPOINTS: Checkpoint[] = [
  { seg: SEG_A, t: 0, label: "Raise capex", time: "6–10 wks", pos: "below" },
  {
    seg: SEG_A,
    t: 0.5,
    label: "Sign a long-term commitment",
    time: "4–8 wks",
    pos: "below",
  },
  { seg: SEG_B, t: 0, label: "Fit-out & compliance", time: "8–16 wks", pos: "above" },
  {
    seg: SEG_B,
    t: 0.5,
    label: "Source & install equipment",
    time: "4–6 wks",
    pos: "above",
  },
];
const BUILD_FINISH: Checkpoint = {
  seg: SEG_B,
  t: 1,
  label: "First experiment",
  time: "Months, door to bench",
  pos: "below",
};

function TrackCheckpoint({
  seg,
  t,
  offsetY,
  label,
  time,
  pos,
  color,
  finish = false,
}: Checkpoint & { offsetY: number; color: string; finish?: boolean }) {
  const [x, y] = cubicPoint(seg, t);
  const left = (x / TRACK_W) * 100;
  const top = ((y + offsetY) / TRACK_H) * 100;
  // The dot alone anchors on the exact curve point (its own -50%/-50%
  // centering); the label is offset from that same anchor independently via
  // top/bottom, so it never drags the dot off the line or ends up straddling
  // it — both were symptoms of centering the whole dot+label stack as one
  // flex block on a single point.
  const labelOffset = finish ? 20 : 16;
  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        width: 0,
        height: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: "translate(-50%, -50%)",
          width: finish ? 18 : 11,
          height: finish ? 18 : 11,
          borderRadius: "50%",
          background: color,
          border: finish ? "3px solid #0c1118" : "none",
          boxShadow: finish ? `0 0 16px ${color}` : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          ...(pos === "below"
            ? { top: labelOffset }
            : { bottom: labelOffset }),
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          // Opaque backing plate — several checkpoints share an x-position
          // with the vertical "same point in time" guide line (and sit close
          // to the track stroke itself), so plain text needs a solid surface
          // behind it rather than floating directly over the line art.
          background: "#0c1118",
          padding: "4px 10px",
          borderRadius: 8,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: finish ? color : `rgba(${T},0.85)`,
            whiteSpace: "nowrap",
          }}
        >
          {finish ? "Finish — " : ""}
          {label}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.06em",
            color,
            whiteSpace: "nowrap",
          }}
        >
          {time}
        </span>
      </div>
    </div>
  );
}

// "Walk in cleared" feature shot — ported from the Claude Design project's
// "Kiosk Check-in Illustration.dc.html" (kiosk stand, scanning beam, a
// confirmation card, a visitor icon walking through, all in the site's own
// teal line-art palette already, so no re-skin was needed). The source used
// fixed-pixel background divs (a radial glow, a dot-grid) sized for a literal
// 1200x675 canvas; folded those into the same <svg viewBox> as the line art
// (gradient + pattern defs) so the whole illustration scales responsively
// inside the feature slot's 16:10 container instead of assuming a fixed px
// canvas. The two looping accents (loading-bar sweep, scan-line ping) are
// driven by fs-kiosk-sweep/fs-kiosk-scan in globals.css, which also carries
// the prefers-reduced-motion override.
function KioskIllustration() {
  return (
    <svg
      viewBox="0 0 1200 675"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <defs>
        <radialGradient id="fs-kiosk-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(26,157,150,0.17)" />
          <stop offset="45%" stopColor="rgba(26,157,150,0.05)" />
          <stop offset="70%" stopColor="transparent" />
        </radialGradient>
        <pattern id="fs-kiosk-dots" width={3} height={3} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={0.5} fill="rgba(255,255,255,0.05)" />
        </pattern>
      </defs>

      <rect width={1200} height={675} fill="#0a0e14" />
      <circle cx={792} cy={297} r={390} fill="url(#fs-kiosk-glow)" />
      <rect width={1200} height={675} fill="url(#fs-kiosk-dots)" opacity={0.5} />

      <g
        fill="none"
        stroke="#4db8b0"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 9px rgba(77,184,176,0.4))" }}
      >
        <path d="M90 566h1020" stroke="rgba(77,184,176,0.3)" />
        <path d="M150 566l36-24M270 566l36-24M990 566l36-24M1080 566l36-24" stroke="rgba(77,184,176,0.14)" />

        <g stroke="rgba(77,184,176,0.22)">
          <path d="M596 96h520" strokeDasharray="8 12" />
          <path d="M1116 96v470" />
        </g>

        <g>
          <rect x={716} y={150} width={272} height={416} rx={3} stroke="rgba(77,184,176,0.5)" />
          <rect x={734} y={166} width={236} height={400} rx={2} stroke="rgba(77,184,176,0.28)" />
          <path
            d="M760 166v400M786 166v400M812 166v400M838 166v400M864 166v400M890 166v400M916 166v400M942 166v400"
            stroke="rgba(77,184,176,0.13)"
          />
          <rect x={768} y={212} width={168} height={120} rx={2} stroke="rgba(77,184,176,0.35)" />
          <path d="M768 272h168M852 212v120" stroke="rgba(77,184,176,0.2)" />
          <circle cx={748} cy={378} r={7} stroke="rgba(127,212,205,0.95)" />
          <path d="M742 370v-8c0-4 3-7 7-7" stroke="rgba(127,212,205,0.7)" />
          <path
            d="M980 300c22-8 30 8 30 22M1002 344c26-4 38 10 40 26M986 254c18-12 30-4 36 6"
            stroke="rgba(127,212,205,0.4)"
            strokeDasharray="5 8"
          />
        </g>

        <g>
          <rect x={596} y={248} width={96} height={128} rx={6} stroke="rgba(77,184,176,0.75)" fill="rgba(26,157,150,0.05)" />
          <rect x={608} y={260} width={72} height={66} rx={3} fill="rgba(26,157,150,0.1)" stroke="rgba(77,184,176,0.4)" />
          <text
            x={644}
            y={288}
            textAnchor="middle"
            fill="#7fd4cd"
            stroke="none"
            style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em" }}
          >
            NOW
          </text>
          <text
            x={644}
            y={304}
            textAnchor="middle"
            fill="#7fd4cd"
            stroke="none"
            style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em" }}
          >
            LOADING
          </text>
          <path d="M615 316h58" stroke="rgba(77,184,176,0.25)" strokeWidth={4} />
          <path
            className="fs-kiosk-sweep"
            d="M615 316h40"
            stroke="#7fd4cd"
            strokeWidth={4}
            strokeDasharray={74}
          />
          <circle cx={644} cy={344} r={9} stroke="rgba(127,212,205,0.8)" />
          <path d="M638 344h12" stroke="rgba(127,212,205,0.5)" />
          <path d="M614 364h60" stroke="rgba(77,184,176,0.85)" strokeWidth={4} />
          <path d="M692 300h24" stroke="rgba(77,184,176,0.2)" strokeDasharray="4 6" />
        </g>

        <g>
          <rect
            x={598}
            y={386}
            width={140}
            height={92}
            rx={8}
            fill="#0a0e14"
            stroke="#7fd4cd"
            style={{ filter: "drop-shadow(0 0 18px rgba(127,212,205,0.6))" }}
          />
          <path d="M598 412h140" stroke="rgba(127,212,205,0.5)" />
          <circle cx={626} cy={446} r={13} stroke="rgba(127,212,205,0.9)" />
          <path d="M621 442h10M621 450h7" stroke="rgba(127,212,205,0.5)" />
          <path d="M652 438h66M652 456h44" stroke="rgba(127,212,205,0.62)" />
          <path d="M612 400h28" stroke="rgba(127,212,205,0.8)" />
          <path d="M744 432c14-16 22-34 22-52" stroke="rgba(127,212,205,0.5)" strokeDasharray="6 8" />
          <path d="M760 388l6 -8 6 10" stroke="rgba(127,212,205,0.7)" />
        </g>

        <g stroke="rgba(77,184,176,0.95)">
          <circle cx={272} cy={222} r={32} />
          <path d="M240 216c2-26 62-26 64 0" stroke="rgba(77,184,176,0.7)" />
          <path d="M258 220h6M280 220h6" />
          <path d="M266 238c4 3 8 3 12 0" />
          <path d="M252 252v8c0 5-4 8-9 9M292 252v8c0 5 4 8 9 9" />
          <path d="M272 254v28" stroke="rgba(77,184,176,0.5)" />
          <path d="M234 314c0-20 16-32 38-32s38 12 38 32l-4 86h-68z" />
          <path d="M236 328c-16 14-24 34-22 56 1 14 4 26 8 36" stroke="rgba(77,184,176,0.85)" />
          <path d="M222 420l-4 14" stroke="rgba(77,184,176,0.6)" />
          <path d="M308 328c20 6 38 16 52 28l38 22" />
          <path d="M272 400v34" stroke="rgba(77,184,176,0.4)" />
          <path d="M242 400l-8 76 2 86" />
          <path d="M230 566h34" stroke="rgba(77,184,176,0.7)" />
          <path d="M302 400l10 74-30 78" />
          <path d="M272 550l32 10" stroke="rgba(77,184,176,0.7)" />
        </g>

        <g>
          <rect
            x={392}
            y={336}
            width={46}
            height={84}
            rx={7}
            stroke="rgba(127,212,205,0.95)"
            fill="rgba(10,14,20,0.9)"
            style={{ filter: "drop-shadow(0 0 12px rgba(127,212,205,0.5))" }}
          />
          <path d="M392 350h46M392 406h46" stroke="rgba(127,212,205,0.4)" />
          <path d="M405 344h20" stroke="rgba(127,212,205,0.6)" />
          <circle cx={415} cy={378} r={12} stroke="rgba(127,212,205,0.85)" />
          <path d="M409 374h12M409 382h8" stroke="rgba(127,212,205,0.55)" />
          <path d="M398 328c-2-8 2-14 8-16" stroke="rgba(127,212,205,0.35)" />
        </g>

        <g>
          <path className="fs-kiosk-scan" d="M452 330h124" stroke="#7fd4cd" strokeDasharray="10 12" />
          <path d="M562 322l10 8-10 8" stroke="rgba(127,212,205,0.8)" />
        </g>
      </g>
    </svg>
  );
}

const STEPS = [
  { n: "1", title: "Create account", body: "Set up your team in a few minutes." },
  {
    n: "2",
    title: "Earn or verify credentials",
    body: "Earn credentials or verify them through a partner facility.",
  },
  {
    n: "3",
    title: "Book a session",
    body: "Pick the instrument or space and the days you need it.",
  },
  { n: "4", title: "Tap in and work", body: "Check in at the kiosk and start." },
];

export default function ForStartups() {
  // Scroll-reveal: elements starting below the fold fade/rise in on intersect.
  // Honours prefers-reduced-motion by showing everything immediately.
  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    const show = (el: HTMLElement) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    };

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) {
      nodes.forEach(show);
      return;
    }

    const vh = window.innerHeight || 800;
    const pending = nodes.filter(
      (el) => el.getBoundingClientRect().top > vh * 0.92
    );
    pending.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(22px)";
      el.style.transition =
        "opacity 640ms cubic-bezier(.2,.7,.2,1), transform 640ms cubic-bezier(.2,.7,.2,1)";
    });
    if (!pending.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show(e.target as HTMLElement);
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );
    pending.forEach((n) => io.observe(n));
    const safety = window.setTimeout(() => pending.forEach(show), 2000);

    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  return (
    <main
      style={{
        position: "relative",
        background: "#0a0e14",
        color: "#e5e7eb",
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      {/* Ambient glows only — no grid overlay, matching the landing page's (app/page.tsx) hero styling */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -260,
            right: -200,
            width: 900,
            height: 900,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${A},0.18), rgba(${A},0.05) 45%, transparent 72%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 1900,
            left: -260,
            width: 820,
            height: 820,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(26,157,150,0.16), rgba(26,157,150,0.04) 46%, transparent 74%)`,
          }}
        />
      </div>

      {/* Hero */}
      <section
        className="fs-hero fs-hero-grid fs-pad"
        style={{
          display: "grid",
          gap: 72,
          alignItems: "center",
        }}
      >
        <div
          data-reveal
          style={{
            position: "relative",
            maxWidth: "32ch",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              fontFamily: MONO,
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: ACCENT,
                boxShadow: `0 0 10px ${ACCENT}`,
                animation: "ss-pulse-glow 2.2s ease-in-out infinite",
              }}
            />
            Solutions · For Startups
          </div>
          <h1
            className="fs-h1"
            style={{
              lineHeight: 1.02,
              letterSpacing: "-0.045em",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Big-lab capability.{" "}
            <span style={{ color: ACCENT }}>Startup-sized commitment.</span>
          </h1>
          <p
            className="fs-lede"
            style={{
              lineHeight: 1.55,
              color: `rgba(${T},0.62)`,
              margin: 0,
              textWrap: "pretty",
            }}
          >
            Book verified access to high-value instruments and regulated
            facilities by the session — no long-term commitment, no fit-out,
            no capex.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
            <Link
              href="/signup"
              className="fs-cta-btn"
              style={{
                background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`,
                color: "#04120f",
                padding: "15px 26px",
                borderRadius: 12,
                fontSize: 15.5,
                fontWeight: 600,
                transition: "transform 240ms ease, box-shadow 240ms ease",
                display: "inline-block",
              }}
            >
              Sign up free →
            </Link>
          </div>
        </div>
        <img
          data-reveal
          src="https://pub-aee5a0705b5048b3bc38888dd602aeac.r2.dev/marketing/for-startups/hero-marketplace-grid.png"
          alt="Marketplace listings — book verified lab space and equipment by the session"
          style={{
            width: "100%",
            height: "auto",
            borderRadius: 16,
            boxShadow: `0 34px 100px -46px rgba(${A},0.5)`,
          }}
        />
      </section>

      {/* Problems */}
      <section className="fs-pad" style={{ paddingBottom: 104 }}>
        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          {PROBLEMS.map((p) => (
            <div
              key={p.text}
              style={{
                background: "rgba(21,26,35,0.6)",
                border: `1px solid rgba(${T},0.07)`,
                borderRadius: 16,
                padding: "28px 26px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width={22}
                height={22}
                fill="none"
                stroke={`rgba(${T},0.35)`}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flex: "none", marginTop: 2 }}
              >
                <path d={p.icon} />
              </svg>
              <p
                style={{
                  fontSize: 16.5,
                  lineHeight: 1.5,
                  color: `rgba(${T},0.55)`,
                  margin: 0,
                  textWrap: "pretty",
                }}
              >
                {p.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features, alternating */}
      {FEATURES.map((f, i) => (
        <section
          key={f.title}
          data-reveal
          className="fs-pad fs-feature"
          style={{
            paddingBottom: 104,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
            gap: 72,
            alignItems: "center",
          }}
        >
          <div
            style={{
              order: i % 2 === 0 ? 1 : 2,
              maxWidth: "34ch",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: ACCENT,
              }}
            >
              {f.eyebrow}
            </span>
            <h2
              className="fs-h2"
              style={{
                lineHeight: 1.08,
                letterSpacing: "-0.038em",
                fontWeight: 700,
                margin: 0,
                textWrap: "balance",
              }}
            >
              {f.title}
            </h2>
            <p
              style={{
                fontSize: 18.5,
                lineHeight: 1.55,
                color: `rgba(${T},0.6)`,
                margin: 0,
                textWrap: "pretty",
              }}
            >
              {f.body}
            </p>
          </div>
          {f.shotUrl ? (
            <img
              src={f.shotUrl}
              alt={f.shot}
              style={{
                order: i % 2 === 0 ? 2 : 1,
                width: "100%",
                height: "auto",
                borderRadius: 16,
                boxShadow: `0 34px 100px -46px rgba(${A},0.5)`,
              }}
            />
          ) : i === 2 ? (
            <div
              style={{
                order: i % 2 === 0 ? 2 : 1,
                borderRadius: 16,
                aspectRatio: "16 / 10",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <KioskIllustration />
            </div>
          ) : (
            <div
              style={{
                order: i % 2 === 0 ? 2 : 1,
                background: "#151a23",
                border: `1px solid rgba(${A},0.18)`,
                borderRadius: 16,
                aspectRatio: "16 / 10",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: `rgba(${A},0.8)`,
                }}
              >
                Coming soon
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: `rgba(${T},0.4)`,
                  maxWidth: "30ch",
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                {f.shot}
              </span>
            </div>
          )}
        </section>
      ))}

      {/* Comparison */}
      <section
        className="fs-pad"
        style={{
          padding: "96px 0 104px",
          background: "#0c1118",
          borderTop: `1px solid rgba(${T},0.07)`,
          borderBottom: `1px solid rgba(${T},0.07)`,
        }}
      >
        <div
          data-reveal
          className="fs-pad"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 44,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            The comparison
          </span>
          <h2
            className="fs-h2"
            style={{
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              fontWeight: 700,
              margin: 0,
              maxWidth: "22ch",
              textWrap: "balance",
            }}
          >
            Three ways to get to your first experiment.
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: `rgba(${T},0.55)`,
              margin: 0,
              maxWidth: "56ch",
            }}
          >
            Same finish line — your first real experiment. Most founders
            weigh the first two before finding the third: build your own
            (real capital, real control), join an incubator (touring
            options, bundled paperwork and liability sign-off, moving
            logistics, a possible wait if they're full, and whatever's
            already on their equipment list), or just book what you need on
            SpaceSnap.
          </p>
        </div>

        <div
          data-reveal
          className="fs-pad fs-track-wrap"
          style={{ overflowX: "auto" }}
        >
          {/* Checkpoint labels at the first/last track positions are centered
              on their point and can bleed past x=0%/100% of the coordinate
              div below — this outer padding gives that bleed somewhere to go
              inside the scrollable area instead of getting clipped at the
              hard edge. */}
          <div style={{ padding: "0 130px", minWidth: 760 + 260 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: `${TRACK_W} / ${TRACK_H}`,
              }}
            >
            {/* Vertical marker: same point in time, SpaceSnap already done */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: `${(700 / TRACK_W) * 100}%`,
                top: 0,
                bottom: 0,
                borderLeft: `2px dashed rgba(${A},0.4)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${(700 / TRACK_W) * 100}%`,
                top: 0,
                transform: "translate(10px, 0)",
                background: "#0c1118",
                padding: "3px 8px",
                borderRadius: 6,
                fontFamily: MONO,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: ACCENT,
                whiteSpace: "nowrap",
              }}
            >
              SpaceSnap opens for business here
            </div>

            {/* Lane labels */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: `${(SNAP_LANE_Y / TRACK_H) * 100}%`,
                background: "#0c1118",
                padding: "3px 8px 3px 0",
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: ACCENT,
              }}
            >
              With SpaceSnap
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: `${(INCUBATOR_LANE_Y / TRACK_H) * 100}%`,
                background: "#0c1118",
                padding: "3px 8px 3px 0",
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: INCUBATOR_ACCENT,
              }}
            >
              Join an incubator
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: `${(BUILD_LANE_Y / TRACK_H) * 100}%`,
                background: "#0c1118",
                padding: "3px 8px 3px 0",
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: `rgba(${T},0.4)`,
              }}
            >
              Build your own
            </div>

            <svg
              viewBox={`0 0 ${TRACK_W} ${TRACK_H}`}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              fill="none"
            >
              {/* Build-your-own: full S track, both bends */}
              <path
                d={`${segPath(SEG_A, BUILD_LANE_Y, true)} ${segPath(SEG_B, BUILD_LANE_Y, false)}`}
                stroke={`rgba(${T},0.22)`}
                strokeWidth={4}
                strokeLinecap="round"
              />
              {/* Incubator: the run actually taken */}
              <path
                d={`${segPath(SEG_A, INCUBATOR_LANE_Y, true)} ${segPath(
                  splitCubicLeft(SEG_B, INCUBATOR_FINISH_T),
                  INCUBATOR_LANE_Y,
                  false
                )}`}
                stroke={INCUBATOR_ACCENT}
                strokeWidth={4}
                strokeLinecap="round"
              />
              {/* Incubator: the rest of the track it never needs */}
              <path
                d={segPath(
                  splitCubicRight(SEG_B, INCUBATOR_FINISH_T),
                  INCUBATOR_LANE_Y,
                  true
                )}
                stroke={`rgba(${T},0.12)`}
                strokeWidth={3}
                strokeDasharray="2 10"
                strokeLinecap="round"
              />
              {/* SpaceSnap: the run actually taken — continues a little past
                  the finish line for the storage subscription stop */}
              <path
                d={`${segPath(SEG_A, SNAP_LANE_Y, true)} ${segPath(
                  splitCubicLeft(SEG_B, SNAP_AFTER_T),
                  SNAP_LANE_Y,
                  false
                )}`}
                stroke={ACCENT}
                strokeWidth={4}
                strokeLinecap="round"
              />
              {/* SpaceSnap: the rest of the track it never needs */}
              <path
                d={segPath(splitCubicRight(SEG_B, SNAP_AFTER_T), SNAP_LANE_Y, true)}
                stroke={`rgba(${T},0.12)`}
                strokeWidth={3}
                strokeDasharray="2 10"
                strokeLinecap="round"
              />
            </svg>

            {SNAP_CHECKPOINTS.map((cp) => (
              <TrackCheckpoint
                key={`snap-${cp.label}`}
                {...cp}
                offsetY={SNAP_LANE_Y}
                color={ACCENT}
              />
            ))}
            <TrackCheckpoint
              {...SNAP_FINISH}
              offsetY={SNAP_LANE_Y}
              color={ACCENT}
              finish
            />
            <TrackCheckpoint {...SNAP_AFTER} offsetY={SNAP_LANE_Y} color={ACCENT} />
            {INCUBATOR_CHECKPOINTS.map((cp) => (
              <TrackCheckpoint
                key={`incubator-${cp.label}`}
                {...cp}
                offsetY={INCUBATOR_LANE_Y}
                color={INCUBATOR_ACCENT}
              />
            ))}
            <TrackCheckpoint
              {...INCUBATOR_FINISH}
              offsetY={INCUBATOR_LANE_Y}
              color={INCUBATOR_ACCENT}
              finish
            />
            {BUILD_CHECKPOINTS.map((cp) => (
              <TrackCheckpoint
                key={`build-${cp.label}`}
                {...cp}
                offsetY={BUILD_LANE_Y}
                color={`rgba(${T},0.7)`}
              />
            ))}
            <TrackCheckpoint
              {...BUILD_FINISH}
              offsetY={BUILD_LANE_Y}
              color={`rgba(${T},0.7)`}
              finish
            />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="fs-pad" style={{ padding: "96px 0 100px" }}>
        <div
          data-reveal
          className="fs-pad"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 44,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            How it works
          </span>
          <h2
            className="fs-h2"
            style={{
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Four steps to bench time.
          </h2>
        </div>
        <div
          className="fs-pad"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {STEPS.map((s) => (
            <div
              key={s.n}
              data-reveal
              className="fs-step"
              style={{
                background: "#151a23",
                border: `1px solid rgba(${T},0.08)`,
                borderRadius: 16,
                padding: "30px 26px 32px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                transition: "border-color 280ms ease",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: `rgba(${A},0.12)`,
                  border: `1px solid rgba(${A},0.35)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: MONO,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: ACCENT,
                }}
              >
                {s.n}
              </span>
              <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.55,
                  color: `rgba(${T},0.55)`,
                  margin: 0,
                  textWrap: "pretty",
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        data-reveal
        className="fs-cta"
        style={{
          margin: "0 56px 96px",
          position: "relative",
          overflow: "hidden",
          borderRadius: 16,
          background: `linear-gradient(140deg, rgba(${A},0.16), rgba(21,26,35,0.5))`,
          border: `1px solid rgba(${A},0.32)`,
          boxShadow: `0 40px 120px -50px rgba(${A},0.6)`,
          display: "flex",
          flexWrap: "wrap",
          gap: 44,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -300,
            left: "24%",
            width: 620,
            height: 620,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${A},0.18), rgba(${A},0.05) 45%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <h2
            className="fs-cta-h"
            style={{
              lineHeight: 1.04,
              letterSpacing: "-0.04em",
              fontWeight: 700,
              margin: "0 0 12px",
              maxWidth: "22ch",
              textWrap: "balance",
            }}
          >
            Your runway is for science. Reduce your burn rate.
          </h2>
          <p
            style={{
              fontSize: 17.5,
              lineHeight: 1.5,
              margin: 0,
              color: `rgba(${T},0.6)`,
              maxWidth: "46ch",
            }}
          >
            Create an account and book your first session.
          </p>
        </div>
        <Link
          href="/signup"
          className="fs-cta-btn"
          style={{
            position: "relative",
            background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`,
            color: "#04120f",
            padding: "20px 34px",
            borderRadius: 12,
            fontSize: 16.5,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            whiteSpace: "nowrap",
            boxShadow: `0 0 40px rgba(${A},0.5)`,
            transition: "transform 280ms ease, box-shadow 280ms ease",
          }}
        >
          Sign up free →
        </Link>
      </section>
    </main>
  );
}

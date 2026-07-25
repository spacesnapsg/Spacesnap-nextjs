"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Platform › List & Fill marketing page (for operators/suppliers).
 *
 * Ported from the Claude Design project "List and Fill" (`List and
 * Fill.dc.html`) — its content, layout and scroll-reveal motion, kept on the
 * design's own violet/purple accent, Geist sans/mono in place of Space
 * Grotesk, and SpaceSnap's site background. Purple is also this site's own
 * "supplier-purple" token (tailwind.config.ts) used across every
 * supplier-facing surface, so this page reuses those exact values rather
 * than the teal used on member-facing marketing pages (DigitalPassport.tsx /
 * MarketplaceFeatures.tsx). Drops the design's own header/footer in favour
 * of the shared marketing chrome (MarketingNavbar accent="purple" /
 * MarketingFooter).
 *
 * The source design's toggle switches and confirm/decline queue actions are
 * kept genuinely interactive (local state, no backend) rather than flattened
 * to a static snapshot — it's cheap to preserve and demonstrates the actual
 * product behaviour to a prospective operator.
 */

// SpaceSnap brand tokens (mirrors tailwind.config.ts's supplier-purple-*,
// the same palette this design's own source HTML already used) — used
// inline because the design leans on rgba tints/glows that Tailwind
// utilities can't express.
const ACCENT = "#9333ea"; // supplier-purple-start
const ACCENT_LIGHT = "#c084fc";
const ACCENT_DEEP = "#6b21a8"; // supplier-purple-end
const ON_TEXT = "#f6f0ff"; // text color for content on solid accent fills
const SANS = "var(--font-geist-sans), Helvetica, Arial, sans-serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
// accent as bare rgb channels, for rgba(... , alpha) tints
const A = "147,51,234";
const A_LIGHT = "192,132,252";
const A_DEEP = "107,33,168"; // supplier-purple-end channels
// neutral text as bare channels
const T = "229,231,235";
const IDLE_BG = "#1b2130";
const IDLE_BORDER = "#2b3446";

type FloorplanCell = { span: number; label: string; lit: boolean };

const FLOORPLAN: FloorplanCell[] = [
  { span: 2, label: "suite 1", lit: false },
  { span: 1, label: "cold storage", lit: false },
  { span: 2, label: "suite 2", lit: false },
  { span: 1, label: "prep", lit: false },
  { span: 1, label: "wash", lit: true },
  { span: 2, label: "suite 3", lit: false },
  { span: 1, label: "store", lit: false },
  { span: 2, label: "suite 4", lit: false },
  { span: 3, label: "cleanroom a", lit: false },
  { span: 3, label: "cleanroom b", lit: false },
  { span: 1, label: "hplc", lit: false },
  { span: 1, label: "lcms", lit: true },
  { span: 2, label: "pilot kitchen", lit: false },
  { span: 1, label: "dry", lit: false },
  { span: 1, label: "office", lit: false },
  { span: 2, label: "incubator", lit: true },
  { span: 2, label: "bench pool", lit: false },
  { span: 2, label: "tissue culture room", lit: true },
];

type ListingKey = "space" | "equipment" | "consumables";

const LISTING_DEFS: {
  key: ListingKey;
  kind: string;
  name: string;
  rates: { unit: string; value: string }[];
  note: string;
}[] = [
  {
    key: "space",
    kind: "Space",
    name: "Cleanroom B — ISO 7",
    rates: [
      { unit: "per day", value: "640 credits" },
      { unit: "per week", value: "3,100 credits" },
      { unit: "per month", value: "10,800 credits" },
    ],
    note: "Day, week or month rates — never by the hour. Set them once; the listing keeps them until you change them.",
  },
  {
    key: "equipment",
    kind: "Equipment",
    name: "LC-MS — Suite 4",
    rates: [
      { unit: "per day", value: "420 credits" },
      { unit: "per week", value: "2,050 credits" },
      { unit: "per month", value: "7,400 credits" },
    ],
    note: "Same three rates as space. Add the certificates a user must hold and the queue enforces them.",
  },
  {
    key: "consumables",
    kind: "Consumables",
    name: "Cell culture media",
    rates: [
      { unit: "per unit", value: "38 credits" },
      { unit: "in stock", value: "126 units" },
      { unit: "bulk requests", value: "accepted" },
    ],
    note: "Priced per unit against live stock. Bulk orders arrive as a single request to approve.",
  },
];

const DEFAULT_AVAILABLE: Record<ListingKey, boolean> = {
  space: true,
  equipment: true,
  consumables: false,
};

const QUEUE_DEFS = [
  {
    id: "q1",
    asset: "LC-MS — Suite 4",
    when: "Thu 14 Aug · 1 day",
    value: "420 credits",
    indicative: false,
    certs: ["LC-MS operation", "Lab safety L2"],
  },
  {
    id: "q2",
    asset: "Cleanroom B — ISO 7",
    when: "Mon 18 Aug · 1 week",
    value: "3,100 credits",
    indicative: false,
    certs: ["Gowning", "ISO 7 protocol"],
  },
  {
    id: "q3",
    asset: "Cell culture media — bulk",
    when: "40 units · collect Wed",
    // Bulk orders settle off-platform — the supplier and member agree the
    // price directly, no credits change hands. Shown as an indicative value
    // only, never as a charged amount.
    value: "~1,520 (indicative)",
    indicative: true,
    certs: ["Handling cert", "Bulk order"],
  },
];

// Net payout by listing type, per month — mirrors what the real Supplier
// Financials "My Earnings" chart sums (SupplierPayable.netAmount: 90% of
// base per booking, 93% of RSP per consumable, already net of SpaceSnap's
// commission and any decline penalties). There's no "own company" revenue
// tracked anywhere in the product — only money that actually paid out.
const MONTHS_RAW = [
  { label: "Feb", space: 6200, equipment: 3400, consumables: 1100 },
  { label: "Mar", space: 6800, equipment: 3900, consumables: 1300 },
  { label: "Apr", space: 7400, equipment: 4100, consumables: 1500 },
  { label: "May", space: 8100, equipment: 4600, consumables: 1700 },
  { label: "Jun", space: 8700, equipment: 5000, consumables: 1900 },
  { label: "Jul", space: 9300, equipment: 5400, consumables: 2100 },
];
const MONTHS_MAX = Math.max(
  ...MONTHS_RAW.map((m) => m.space + m.equipment + m.consumables)
);
const MONTHS_TOTAL = MONTHS_RAW.reduce(
  (sum, m) => sum + m.space + m.equipment + m.consumables,
  0
);
const MONTHS = MONTHS_RAW.map((m) => {
  const scale = 168 / MONTHS_MAX;
  const total = m.space + m.equipment + m.consumables;
  return {
    ...m,
    total: (total / 1000).toFixed(1) + "k credits",
    spaceH: Math.round(m.space * scale),
    equipmentH: Math.round(m.equipment * scale),
    consumablesH: Math.round(m.consumables * scale),
  };
});

// The real notice-based tiers a supplier decline is penalized against
// (calculateSupplierCancellationPenalty, lib/booking-policy.ts) — a portion
// of SpaceSnap's own commission on that booking is forfeited, sized by how
// much notice you gave before the session was due to start. Marketing copy
// below frames this as a "service recovery charge" rather than naming it as
// SpaceSnap's commission specifically. A member cancelling never costs you
// anything at all — that's covered above the cards, not by a fourth tier.
const PROTECTION = [
  {
    notice: "7+ days before session",
    figure: "0%",
    note: "Plenty of time to re-list the slot. Decline this early and no service recovery charge applies.",
    level: 0,
  },
  {
    notice: "3–6 days before session",
    figure: "50%",
    note: "Inside a week, half of the service recovery charge applies if you decline this late.",
    level: 2,
  },
  {
    notice: "Under 3 days before session",
    figure: "100%",
    note: "This close in, the full service recovery charge applies — the same notice window a member's own cancellation refund runs on.",
    level: 3,
  },
];

export default function ListAndFill() {
  const [available, setAvailable] =
    useState<Record<ListingKey, boolean>>(DEFAULT_AVAILABLE);
  const [queueState, setQueueState] = useState<
    Record<string, "confirmed" | "declined">
  >({});

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

  const openCount = QUEUE_DEFS.filter((q) => !queueState[q.id]).length;

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
      {/* Hero */}
      <section
        className="lf-hero"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: 64,
          alignItems: "center",
          borderBottom: `1px solid rgba(${T},0.1)`,
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -240,
            right: -140,
            width: 820,
            height: 820,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 50%, rgba(${A},0.2), rgba(${A},0.06) 46%, rgba(${A},0) 72%)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: "32ch",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div
            data-reveal
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              fontFamily: MONO,
              fontSize: 11.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: ACCENT,
              width: "fit-content",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: ACCENT,
                boxShadow: `0 0 12px ${ACCENT}`,
                animation: "ss-pulse-glow 2.2s ease-in-out infinite",
              }}
            />
            For operators — List &amp; Fill
          </div>
          <h1
            data-reveal
            className="lf-h1"
            style={{
              fontFamily: SANS,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              fontWeight: 900,
              margin: 0,
            }}
          >
            It&apos;s already yours.
            <br />
            <span
              style={{
                color: ACCENT,
                textShadow: `0 0 34px rgba(${A},0.5), 0 0 90px rgba(${A},0.22)`,
              }}
            >
              Most of it is asleep.
            </span>
          </h1>
          <p
            data-reveal
            className="lf-lede"
            style={{
              lineHeight: 1.55,
              color: `rgba(${T},0.62)`,
              margin: 0,
              textWrap: "pretty",
            }}
          >
            Your rooms are contracted. Your instruments are insured. Between
            industry highs and lows, they sit dark. List those days and they
            earn — with no extra admin load and no new risk on you.
          </p>
          <div
            data-reveal
            style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}
          >
            <a
              href="#start"
              className="lf-hero-cta"
              style={{
                background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`,
                color: ON_TEXT,
                padding: "15px 26px",
                borderRadius: 10,
                fontSize: 15.5,
                fontWeight: 700,
                transition: "transform 240ms ease, box-shadow 240ms ease",
                display: "inline-block",
              }}
            >
              List your first asset
            </a>
            <a
              href="#queue"
              style={{
                border: `1px solid rgba(${T},0.2)`,
                color: `rgba(${T},0.75)`,
                padding: "15px 24px",
                borderRadius: 10,
                fontSize: 15.5,
                fontWeight: 600,
                display: "inline-block",
              }}
            >
              See the booking queue
            </a>
          </div>
        </div>

        <div
          data-reveal
          style={{
            position: "relative",
            background: "#151a23",
            border: `1px solid rgba(${T},0.1)`,
            borderRadius: 16,
            padding: 26,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              Level 3 — Life sciences wing
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: `rgba(${T},0.45)`,
              }}
            >
              TUESDAY
            </span>
          </div>
          <div
            className="lf-grid6"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gridAutoRows: 52,
              gap: 8,
            }}
          >
            {FLOORPLAN.map((cell, i) => (
              <div
                key={i}
                style={{
                  gridColumn: `span ${cell.span}`,
                  borderRadius: 8,
                  border: cell.lit
                    ? `1px solid rgba(${A_LIGHT},0.7)`
                    : `1px solid ${IDLE_BORDER}`,
                  background: cell.lit
                    ? `linear-gradient(135deg, rgba(${A},0.5), rgba(${A_DEEP},0.35))`
                    : IDLE_BG,
                  boxShadow: cell.lit
                    ? `0 0 26px -4px rgba(${A},0.75), inset 0 0 20px rgba(${A},0.2)`
                    : "none",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "7px 9px",
                  fontFamily: MONO,
                  fontSize: 9.5,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: cell.lit ? "#f0e2ff" : `rgba(${T},0.3)`,
                }}
              >
                {cell.label}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              marginTop: 20,
              paddingTop: 18,
              borderTop: `1px solid rgba(${T},0.1)`,
              fontFamily: MONO,
              fontSize: 11,
              color: `rgba(${T},0.5)`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: IDLE_BORDER,
                }}
              />
              Idle
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`,
                }}
              />
              In-use
            </span>
            <span style={{ marginLeft: "auto", color: ACCENT }}>
              14 of 18 zones idle right now
            </span>
          </div>
        </div>
      </section>

      {/* List in minutes */}
      <section className="lf-pad lf-section">
        <div
          data-reveal
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 28,
            flexWrap: "wrap",
            marginBottom: 40,
          }}
        >
          <h2
            className="lf-h2"
            style={{
              lineHeight: 1.06,
              letterSpacing: "-0.035em",
              fontWeight: 800,
              margin: 0,
            }}
          >
            List in minutes
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: `rgba(${T},0.55)`,
              margin: 0,
              maxWidth: "42ch",
            }}
          >
            Three kinds of listing, each with the pricing model that fits it.
            One toggle takes any of them off the market and puts it back —
            nothing to delete, nothing to rebuild.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {LISTING_DEFS.map((l) => {
            const on = available[l.key];
            return (
              <div
                key={l.key}
                data-reveal
                style={{
                  position: "relative",
                  background: "#151a23",
                  border: `1px solid ${
                    on ? `rgba(${A},0.45)` : "#242c3a"
                  }`,
                  borderRadius: 16,
                  padding: "30px 28px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  opacity: on ? 1 : 0.6,
                  transition: "border-color 240ms ease, opacity 240ms ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 10.5,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: ACCENT,
                      }}
                    >
                      {l.kind}
                    </span>
                    <h3
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                        margin: 0,
                      }}
                    >
                      {l.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAvailable((prev) => ({ ...prev, [l.key]: !prev[l.key] }))
                    }
                    aria-label={`Toggle availability for ${l.name}`}
                    aria-pressed={on}
                    className="lf-toggle"
                    style={{
                      flex: "none",
                      width: 52,
                      height: 28,
                      borderRadius: 999,
                      border: `1px solid ${
                        on ? `rgba(${A_LIGHT},0.6)` : "#333c4d"
                      }`,
                      background: on
                        ? `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`
                        : IDLE_BORDER,
                      padding: 3,
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: on ? "flex-end" : "flex-start",
                      transition: "background 240ms ease, border-color 240ms ease",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: on ? ON_TEXT : `rgba(${T},0.5)`,
                        boxShadow: on
                          ? "0 0 12px rgba(246,240,255,0.8)"
                          : "none",
                        transition: "background 240ms ease",
                      }}
                    />
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                    borderTop: `1px solid rgba(${T},0.1)`,
                    paddingTop: 16,
                  }}
                >
                  {l.rates.map((r) => (
                    <div
                      key={r.unit}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        fontFamily: MONO,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: `rgba(${T},0.5)` }}>{r.unit}</span>
                      <span>{r.value}</span>
                    </div>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: `rgba(${T},0.52)`,
                    margin: 0,
                    textWrap: "pretty",
                  }}
                >
                  {l.note}
                </p>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: on ? ACCENT : `rgba(${T},0.4)`,
                    marginTop: "auto",
                  }}
                >
                  {on
                    ? "available — accepting requests"
                    : "unavailable — kept, not deleted"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* The queue runs itself */}
      <section
        id="queue"
        className="lf-pad lf-section"
        style={{
          borderTop: `1px solid rgba(${T},0.1)`,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 64,
          alignItems: "start",
        }}
      >
        <div
          data-reveal
          style={{
            maxWidth: "34ch",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            The queue runs itself
          </span>
          <h2
            className="lf-h2"
            style={{
              lineHeight: 1.06,
              letterSpacing: "-0.035em",
              fontWeight: 800,
              margin: 0,
            }}
          >
            You only see requests you can actually approve.
          </h2>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: `rgba(${T},0.6)`,
              margin: 0,
              textWrap: "pretty",
            }}
          >
            Required certificates are checked before a request reaches you. If
            someone isn&apos;t cleared for the asset, they never land in your
            queue. You confirm or decline — that&apos;s the whole job.
          </p>
          <div
            style={{
              border: `1px solid rgba(${A},0.3)`,
              borderRadius: 12,
              padding: "16px 18px",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                flex: "none",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`,
                marginTop: 6,
              }}
            />
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: `rgba(${T},0.55)`,
                margin: 0,
              }}
            >
              <span style={{ color: ACCENT, fontWeight: 600 }}>
                What your member sees:
              </span>{" "}
              their{" "}
              <Link
                href="/platform/digital-passport"
                style={{ color: ACCENT_LIGHT, textDecoration: "underline" }}
              >
                Digital Passport
              </Link>{" "}
              is matched against your requirements before they can send a
              request.
            </p>
          </div>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.5,
              color: `rgba(${T},0.45)`,
              margin: 0,
            }}
          >
            Consumables come through the same queue, including bulk order
            requests. Those settle off-platform — you and the buyer agree the
            price directly.
          </p>
        </div>

        <div
          data-reveal
          style={{
            background: "#151a23",
            border: `1px solid rgba(${T},0.1)`,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              borderBottom: `1px solid rgba(${T},0.1)`,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              Incoming requests
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: ACCENT }}>
              {openCount} awaiting you
            </span>
          </div>
          {QUEUE_DEFS.map((q) => {
            const st = queueState[q.id];
            const pending = !st;
            return (
              <div
                key={q.id}
                style={{
                  padding: "22px 24px",
                  borderBottom: `1px solid rgba(${T},0.1)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  opacity: st === "declined" ? 0.45 : 1,
                  transition: "opacity 300ms ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 18,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {q.asset}
                    </span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 12,
                        color: `rgba(${T},0.5)`,
                      }}
                    >
                      {q.when}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: q.indicative ? 12.5 : 14,
                      color: q.indicative ? `rgba(${T},0.5)` : "#e6edf3",
                      textAlign: "right",
                    }}
                  >
                    {q.value}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {q.certs.map((cert) => (
                    <span
                      key={cert}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        border: `1px solid rgba(${A},0.35)`,
                        borderRadius: 999,
                        padding: "5px 11px",
                        fontFamily: MONO,
                        fontSize: 10.5,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: `rgba(${T},0.7)`,
                      }}
                    >
                      <span style={{ color: ACCENT }}>✓</span>
                      {cert}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {pending ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setQueueState((prev) => ({
                            ...prev,
                            [q.id]: "confirmed",
                          }))
                        }
                        style={{
                          background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`,
                          color: ON_TEXT,
                          border: "none",
                          borderRadius: 9,
                          padding: "11px 20px",
                          fontFamily: SANS,
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQueueState((prev) => ({
                            ...prev,
                            [q.id]: "declined",
                          }))
                        }
                        style={{
                          background: "transparent",
                          color: `rgba(${T},0.6)`,
                          border: "1px solid #2b3446",
                          borderRadius: 9,
                          padding: "11px 18px",
                          fontFamily: SANS,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 11.5,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: st === "confirmed" ? ACCENT : `rgba(${T},0.4)`,
                      }}
                    >
                      {st === "confirmed"
                        ? "confirmed — added to your calendar"
                        : "declined — slot back to idle"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div
            style={{
              padding: "18px 24px",
              fontFamily: MONO,
              fontSize: 11,
              color: `rgba(${T},0.38)`,
            }}
          >
            Requests without matching certificates never appear here.
          </div>
        </div>
      </section>

      {/* Revenue, visible */}
      <section
        className="lf-pad lf-section"
        style={{
          borderTop: `1px solid rgba(${T},0.1)`,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 64,
          alignItems: "center",
        }}
      >
        <div
          data-reveal
          style={{
            maxWidth: "32ch",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            Revenue, visible
          </span>
          <h2
            className="lf-h2"
            style={{
              lineHeight: 1.06,
              letterSpacing: "-0.035em",
              fontWeight: 800,
              margin: 0,
            }}
          >
            See what the idle days are worth.
          </h2>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: `rgba(${T},0.6)`,
              margin: 0,
              textWrap: "pretty",
            }}
          >
            What you actually receive each month, by listing type. The same
            number that lands in your payout, no reconciliation needed.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 22,
              fontFamily: MONO,
              fontSize: 11.5,
              color: `rgba(${T},0.5)`,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: `linear-gradient(180deg, ${ACCENT_LIGHT}, ${ACCENT})`,
                }}
              />
              Space
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: ACCENT_DEEP,
                }}
              />
              Equipment
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: IDLE_BORDER,
                }}
              />
              Consumables
            </span>
          </div>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: `rgba(${T},0.42)`,
              margin: 0,
            }}
          >
            Paid out every two weeks — SpaceSnap batches and settles it for
            you, no invoicing on your side.
          </p>
        </div>
        <div
          data-reveal
          style={{
            background: "#151a23",
            border: `1px solid rgba(${T},0.1)`,
            borderRadius: 16,
            padding: "28px 26px 22px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              marginBottom: 26,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: `rgba(${T},0.42)`,
              }}
            >
              Last 6 months, net payout · credits
            </span>
            <span style={{ fontFamily: MONO, fontSize: 28, color: ACCENT }}>
              {(MONTHS_TOTAL / 1000).toFixed(1)}k credits
            </span>
          </div>
          <div
            className="lf-grid6"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 14,
              alignItems: "end",
              height: 210,
            }}
          >
            {MONTHS.map((m) => (
              <div
                key={m.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  gap: 4,
                  height: "100%",
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    color: `rgba(${T},0.55)`,
                    textAlign: "center",
                  }}
                >
                  {m.total}
                </span>
                <div
                  style={{
                    height: m.spaceH,
                    borderRadius: "5px 5px 0 0",
                    background: `linear-gradient(180deg, ${ACCENT_LIGHT}, ${ACCENT})`,
                  }}
                />
                <div
                  style={{
                    height: m.equipmentH,
                    background: ACCENT_DEEP,
                  }}
                />
                <div
                  style={{
                    height: m.consumablesH,
                    borderRadius: "0 0 5px 5px",
                    background: IDLE_BORDER,
                  }}
                />
              </div>
            ))}
          </div>
          <div
            className="lf-grid6"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 14,
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid rgba(${T},0.1)`,
            }}
          >
            {MONTHS.map((m) => (
              <span
                key={m.label}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: `rgba(${T},0.42)`,
                  textAlign: "center",
                }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Protected either way */}
      <section className="lf-pad lf-section" style={{ borderTop: `1px solid rgba(${T},0.1)` }}>
        <div
          data-reveal
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 28,
            flexWrap: "wrap",
            marginBottom: 40,
          }}
        >
          <h2
            className="lf-h2"
            style={{
              lineHeight: 1.06,
              letterSpacing: "-0.035em",
              fontWeight: 800,
              margin: 0,
            }}
          >
            Fair, either way
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: `rgba(${T},0.55)`,
              margin: 0,
              maxWidth: "42ch",
            }}
          >
            If a member cancels, it never costs you anything — no penalty,
            ever. If you need to decline a confirmed booking yourself, how
            much notice you give decides how much of a service recovery
            charge applies.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {PROTECTION.map((p) => {
            const accentLevel = p.level > 0;
            const strong = p.level === 3;
            return (
              <div
                key={p.notice}
                data-reveal
                style={{
                  background: "#151a23",
                  border: `1px solid ${
                    strong
                      ? `rgba(${A},0.65)`
                      : accentLevel
                      ? `rgba(${A},0.35)`
                      : "#242c3a"
                  }`,
                  borderRadius: 16,
                  padding: "30px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: `rgba(${T},0.45)`,
                  }}
                >
                  {p.notice}
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 42,
                      fontWeight: 800,
                      letterSpacing: "-0.04em",
                      color: accentLevel ? ACCENT : `rgba(${T},0.55)`,
                    }}
                  >
                    {p.figure}
                  </span>
                  <span
                    style={{
                      fontSize: 14.5,
                      color: `rgba(${T},0.45)`,
                      lineHeight: 1.4,
                    }}
                  >
                    service recovery
                    <br />
                    charged if you decline
                  </span>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        height: 6,
                        flex: 1,
                        borderRadius: 999,
                        background:
                          i < p.level
                            ? strong
                              ? ACCENT
                              : `rgba(${A},0.75)`
                            : IDLE_BORDER,
                      }}
                    />
                  ))}
                </div>
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: `rgba(${T},0.55)`,
                    margin: 0,
                    textWrap: "pretty",
                  }}
                >
                  {p.note}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Start CTA */}
      <section
        id="start"
        data-reveal
        className="lf-pad lf-cta"
        style={{
          borderTop: `1px solid rgba(${T},0.1)`,
          display: "flex",
          flexWrap: "wrap",
          gap: 44,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ maxWidth: "30ch" }}>
          <h2
            className="lf-cta-h"
            style={{
              lineHeight: 1.04,
              letterSpacing: "-0.04em",
              fontWeight: 900,
              margin: "0 0 14px",
            }}
          >
            Put one idle asset on the market.
          </h2>
          <p
            style={{
              fontSize: 17.5,
              lineHeight: 1.55,
              color: `rgba(${T},0.55)`,
              margin: 0,
            }}
          >
            Start with a single room or instrument. You decide what&apos;s
            available, when — and you can switch it off with one toggle.
          </p>
        </div>
        <Link
          href="/signup"
          className="lf-cta-btn"
          style={{
            background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`,
            color: ON_TEXT,
            padding: "20px 34px",
            borderRadius: 12,
            fontSize: 17,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            whiteSpace: "nowrap",
            transition: "transform 260ms ease, box-shadow 260ms ease",
          }}
        >
          List your first asset <span>→</span>
        </Link>
      </section>
    </main>
  );
}

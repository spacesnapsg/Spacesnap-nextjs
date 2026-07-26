"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Platform › Marketplace ("Features") marketing page.
 *
 * Ported from the Claude Design project "SpaceSnap Features" — content + the
 * design's aggressive scale/motion, but re-skinned onto SpaceSnap's own visual
 * system (teal accent, site background, Geist sans/mono) rather than the
 * source's neon-green + Archivo look, and dropping the design's own
 * navbar/footer in favour of the shared marketing chrome.
 *
 * Copy note: the source's "No lease"/"long lease" lines were reworded per the
 * no-"lease" marketing-copy constraint.
 */

// SpaceSnap brand tokens (mirrors tailwind.config.ts) — used inline because the
// design leans on rgba tints/glows that Tailwind utilities can't express.
const ACCENT = "#4db8b0"; // user-teal-end
const ACCENT_DEEP = "#1a9d96"; // user-teal-start
const ACCENT_LIGHT = "#7fd4cd";
const SANS = "var(--font-geist-sans), Helvetica, Arial, sans-serif";
const MONO = "var(--font-geist-mono), ui-monospace, monospace";
// accent as bare rgb channels, for rgba(... , alpha) tints
const A = "77,184,176";

// "The difference" section image, uploaded to the R2 public bucket
// (mirrors DigitalPassport.tsx's PASSPORT_SCREENSHOT_URL convention).
const LAB_SPACE_PHOTO_URL =
  "https://pub-aee5a0705b5048b3bc38888dd602aeac.r2.dev/marketing/marketplace-features/lab-space-v2.png";

const FEATURES = [
  {
    num: "01",
    title: "Live listings from suppliers",
    body: "Companies with spare capacity post what they actually have — a fitted lab bay, a cold room running half empty, a floor of unused desks. Real inventory, not brochures.",
  },
  {
    num: "02",
    title: "No landlord agreements",
    body: "No agents, no deposits, no multi-year contract to negotiate. You book on SpaceSnap's simple standard terms, and the supplier keeps the space.",
  },
  {
    num: "03",
    title: "Keep your work on site",
    body: "Subscribe to a base monthly membership and store your materials, cells and products at a space you designate — so your work stays put between bookings, without paying to hold a whole space of your own.",
  },
  {
    num: "04",
    title: "Zero capital outlay",
    body: "The fit-out, the equipment and the compliance are already paid for. You buy access — not a line on your balance sheet.",
  },
  {
    num: "05",
    title: "Built for testing and expansion",
    body: "Prove a process, run a pilot batch, land in a new region without betting on it. If it works, stay. If it doesn't, walk.",
  },
];

const BOOKABLE_TYPES = [
  "Biotech labs",
  "Food tech labs",
  "Cold storage",
  "Clean rooms",
  "Bench space",
  "Offices",
  "Desks",
  "Meeting rooms",
];

export default function MarketplaceFeatures() {
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
            top: -220,
            left: -160,
            width: 880,
            height: 880,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 50%, rgba(${A},0.26), rgba(${A},0.10) 40%, rgba(${A},0) 72%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 700,
            right: -260,
            width: 820,
            height: 820,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, rgba(26,157,150,0.22), rgba(26,157,150,0.08) 42%, rgba(26,157,150,0) 74%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -180,
            left: "22%",
            width: 760,
            height: 760,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, rgba(125,212,205,0.14), rgba(125,212,205,0.05) 44%, rgba(125,212,205,0) 74%)",
          }}
        />
      </div>

      <div style={{ position: "relative" }}>
        {/* Hero */}
        <section
          style={{ padding: "110px 56px 84px", maxWidth: 1200 }}
          className="ss-hero"
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
              border: `1px solid rgba(${A},0.3)`,
              borderRadius: 999,
              padding: "8px 16px",
              marginBottom: 34,
              background: `rgba(${A},0.06)`,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: ACCENT,
                boxShadow: `0 0 12px ${ACCENT}`,
                animation: "ss-pulse-glow 1.8s ease-in-out infinite",
              }}
            />
            For teams who need space now
          </div>
          <h1
            data-reveal
            className="ss-h1"
            style={{
              position: "relative",
              lineHeight: 0.94,
              letterSpacing: "-0.045em",
              fontWeight: 900,
              margin: "0 0 30px",
              maxWidth: "16ch",
              textWrap: "balance",
            }}
          >
            Space on demand.
            <span
              style={{
                display: "block",
                color: ACCENT,
                textShadow: `0 0 34px rgba(${A},0.55), 0 0 90px rgba(${A},0.25)`,
              }}
            >
              No lock-in. No wait.
            </span>
          </h1>
          <p
            data-reveal
            className="ss-lede"
            style={{
              lineHeight: 1.5,
              color: "rgba(229,231,235,0.66)",
              maxWidth: "56ch",
              margin: "0 0 40px",
              textWrap: "pretty",
            }}
          >
            We plug your company into the underused assets of every other
            company — labs, cold storage, benches, desks — and turn them into
            capacity you can book today.
          </p>
          <div
            data-reveal
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 40,
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(229,231,235,0.42)",
            }}
          >
            <span>0 landlord agreements</span>
            <span>0 capital outlay</span>
            <span>book by the day</span>
          </div>
        </section>

        {/* Feature grid */}
        <section style={{ padding: "0 56px" }} className="ss-pad">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
              gap: 18,
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.num}
                data-reveal
                className="ss-card"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 20,
                  border: `1px solid rgba(${A},0.16)`,
                  background: `linear-gradient(160deg, rgba(${A},0.075), rgba(21,26,35,0.55) 52%)`,
                  padding: "36px 32px 40px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 15,
                  minHeight: 286,
                  transition:
                    "transform 420ms cubic-bezier(.2,.7,.2,1), box-shadow 420ms ease, border-color 420ms ease",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
                    opacity: 0.5,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      letterSpacing: "0.1em",
                      color: ACCENT,
                    }}
                  >
                    {f.num}
                  </span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: ACCENT,
                      boxShadow: `0 0 14px ${ACCENT}`,
                      opacity: 0.85,
                    }}
                  />
                </div>
                <h3
                  style={{
                    fontSize: 29,
                    fontWeight: 800,
                    letterSpacing: "-0.028em",
                    lineHeight: 1.1,
                    margin: 0,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: "rgba(229,231,235,0.62)",
                    margin: 0,
                    textWrap: "pretty",
                  }}
                >
                  {f.body}
                </p>
              </div>
            ))}

            {/* Digital Passport "up next" card */}
            <Link
              href="/platform/digital-passport"
              data-reveal
              className="ss-passport-card"
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 20,
                padding: "36px 32px",
                minHeight: 286,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 12,
                color: "#0a0e14",
                background: `linear-gradient(150deg, ${ACCENT_LIGHT}, ${ACCENT} 45%, ${ACCENT_DEEP})`,
                boxShadow: `0 30px 80px -30px rgba(${A},0.75)`,
                transition:
                  "transform 420ms cubic-bezier(.2,.7,.2,1), box-shadow 420ms ease",
              }}
            >
              <div
                style={{
                  position: "relative",
                  fontFamily: MONO,
                  fontSize: 11.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(10,14,20,0.6)",
                }}
              >
                Up next
              </div>
              <h3
                style={{
                  position: "relative",
                  fontSize: 32,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  margin: 0,
                }}
              >
                Digital Passport
              </h3>
              <p
                style={{
                  position: "relative",
                  fontSize: 15.5,
                  lineHeight: 1.5,
                  margin: 0,
                  color: "rgba(10,14,20,0.72)",
                }}
              >
                One verified record of compliance, insurance and credentials —
                reused at every space you book.
              </p>
              <span
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 6,
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#0a0e14",
                }}
              >
                See how it works <span>→</span>
              </span>
            </Link>
          </div>
        </section>

        {/* The difference */}
        <section className="ss-difference">
          <div data-reveal>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 11.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: ACCENT,
                marginBottom: 22,
              }}
            >
              The difference
            </div>
            <h2
              className="ss-h2"
              style={{
                lineHeight: 1.02,
                letterSpacing: "-0.038em",
                fontWeight: 900,
                margin: "0 0 24px",
                textWrap: "balance",
              }}
            >
              There was no on-demand market for lab space.
              <span
                style={{
                  color: ACCENT,
                  textShadow: `0 0 30px rgba(${A},0.5)`,
                }}
              >
                {" "}
                So we built it.
              </span>
            </h2>
            <p
              style={{
                fontSize: 18.5,
                lineHeight: 1.6,
                color: "rgba(229,231,235,0.66)",
                margin: 0,
                maxWidth: "46ch",
                textWrap: "pretty",
              }}
            >
              Every other route to a biotech lab, food tech bench or cold room
              means a long commitment with a regulatory gauntlet bolted on. Here
              it&apos;s measured in days, not months.
            </p>
          </div>
          <div
            data-reveal
            style={{
              position: "relative",
              borderRadius: 20,
              overflow: "hidden",
              border: `1px solid rgba(${A},0.22)`,
              aspectRatio: "16 / 9", // matches lab-space-v2.png's native 1328×744 ratio, avoids object-fit: cover cropping it
              boxShadow: `0 30px 90px -40px rgba(${A},0.6)`,
            }}
          >
            <img
              src={LAB_SPACE_PHOTO_URL}
              alt="A lab space listed on SpaceSnap"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        </section>

        {/* Bookable-types marquee */}
        <section style={{ padding: "0 0 104px" }}>
          <div
            className="ss-pad"
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(229,231,235,0.42)",
              marginBottom: 26,
            }}
          >
            What you can book
          </div>
          <div style={{ position: "relative", overflow: "hidden" }}>
            <div
              className="ss-marquee-track"
              style={{
                display: "flex",
                width: "max-content",
                gap: 14,
                animation: "ss-marquee 34s linear infinite",
              }}
            >
              {[...BOOKABLE_TYPES, ...BOOKABLE_TYPES].map((t, i) => (
                <div
                  key={i}
                  style={{
                    border: `1px solid rgba(${A},0.25)`,
                    borderRadius: 999,
                    padding: "14px 26px",
                    fontSize: 16,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    color: "rgba(229,231,235,0.82)",
                    background: `rgba(${A},0.05)`,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section data-reveal className="ss-cta">
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -300,
              left: "20%",
              width: 620,
              height: 620,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(${A},0.20), rgba(${A},0.06) 45%, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <h2
              className="ss-cta-h"
              style={{
                lineHeight: 1.04,
                letterSpacing: "-0.035em",
                fontWeight: 900,
                margin: "0 0 14px",
                maxWidth: "24ch",
                textWrap: "balance",
              }}
            >
              Booking is fast because your paperwork travels with you.
            </h2>
            <p
              style={{
                fontSize: 17.5,
                lineHeight: 1.5,
                margin: 0,
                color: "rgba(229,231,235,0.62)",
                maxWidth: "46ch",
              }}
            >
              Next: the Digital Passport — compliance cleared once, portable
              everywhere.
            </p>
          </div>
          <Link
            href="/platform/digital-passport"
            className="ss-cta-btn"
            style={{
              position: "relative",
              background: ACCENT,
              color: "#0a0e14",
              padding: "21px 34px",
              borderRadius: 999,
              fontSize: 16.5,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              whiteSpace: "nowrap",
              boxShadow: `0 0 40px rgba(${A},0.6)`,
              transition: "transform 300ms ease, box-shadow 300ms ease",
            }}
          >
            Explore Digital Passport <span>→</span>
          </Link>
        </section>
      </div>
    </main>
  );
}

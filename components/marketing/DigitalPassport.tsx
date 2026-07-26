"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Platform › Digital Passport marketing page.
 *
 * Ported from the Claude Design project "Digital Passport" (`Digital
 * Passport.dc.html`) — its content, layout and aggressive scale/scroll-reveal
 * motion, but re-skinned onto SpaceSnap's own visual system (teal accent, site
 * background, Geist sans/mono) rather than the source's neon-green + Archivo
 * look, and dropping the design's own header/footer in favour of the shared
 * marketing chrome (MarketingNavbar/MarketingFooter). Mirrors the sibling
 * MarketplaceFeatures.tsx conventions.
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

// Example passport-UI capture (see public/passport-preview.html for the
// source page), uploaded to the R2 public bucket.
const PASSPORT_SCREENSHOT_URL =
  "https://pub-aee5a0705b5048b3bc38888dd602aeac.r2.dev/marketing/digital-passport/passport-ui.webp";

const STATS = [
  { k: "Yours, not your employer's", v: "ownership" },
  { k: "Verified at source", v: "issuance" },
  { k: "Minutes, not weeks", v: "re-onboarding" },
];

const CREDENTIALS = [
  {
    num: "01",
    issuer: "Space operators",
    title: "Training proficiencies",
    body: "What you're actually competent to run — assays, handling classes, emergency response — recorded against the person who assessed you.",
  },
  {
    num: "02",
    issuer: "Space operators",
    title: "Onboarding credentials",
    body: "Site inductions and safety briefings for each space — quick and fuss-free to complete before you even book.",
  },
  {
    num: "03",
    issuer: "Manufacturers",
    title: "Equipment Training",
    body: "Sign-offs from whoever built the equipment or maintains it. If you're cleared on the platform, the next lab can see it.",
  },
  {
    num: "04",
    issuer: "Each space",
    title: "House rules, acknowledged",
    body: "Every space has its own way of working. You read and accept its rules once, and the acceptance is logged before you arrive.",
  },
];

const BEFORE = [
  "Re-do the same induction at every new site",
  "Paper certificates chased over email",
  "Operators re-testing competence they can't verify",
  "Equipment sign-offs stuck with a former employer",
  "Significant time spent training",
];

const AFTER = [
  "One record, accepted across the network",
  "Credentials verified at source by the issuer",
  "Operators see proficiency and expiry instantly",
  "Validations belong to you and move with you",
  "House rules accepted before you arrive",
];

export default function DigitalPassport() {
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
      {/* Hero */}
      <section
        style={{
          position: "relative",
          borderBottom: `1px solid rgba(${T},0.1)`,
          overflow: "hidden",
        }}
      >
        {/* Ambient glow only — no grid overlay, matching the landing page's (app/page.tsx) hero styling */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -280,
            left: -180,
            width: 900,
            height: 900,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 50%, rgba(${A},0.2), rgba(${A},0.06) 44%, rgba(${A},0) 72%)`,
            pointerEvents: "none",
          }}
        />
        <div className="dp-hero-grid" style={{ position: "relative" }}>
          <div className="dp-hero-copy">
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
                marginBottom: 30,
                background: `rgba(${A},0.06)`,
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
                  animation: "ss-pulse-glow 2s ease-in-out infinite",
                }}
              />
              For members who shouldn&apos;t have to prove it twice
            </div>
            <h1
              data-reveal
              className="dp-h1"
              style={{
                lineHeight: 0.93,
                letterSpacing: "-0.048em",
                fontWeight: 900,
                margin: "0 0 32px",
                maxWidth: "14ch",
                textWrap: "balance",
              }}
            >
              Prove it once.
              <br />
              <span
                style={{
                  color: ACCENT,
                  textShadow: `0 0 34px rgba(${A},0.5), 0 0 90px rgba(${A},0.22)`,
                }}
              >
                Work anywhere.
              </span>
            </h1>
            <p
              data-reveal
              className="dp-lede"
              style={{
                lineHeight: 1.5,
                color: `rgba(${T},0.64)`,
                maxWidth: "50ch",
                margin: "0 0 44px",
                textWrap: "pretty",
              }}
            >
              A portable, verified record of what you&apos;re trained on and
              cleared to do — issued by the space operators, equipment
              manufacturers and subject matter experts who actually signed you
              off.
            </p>
            <div
              data-reveal
              className="dp-stats"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, max-content)",
                gap: "0 44px",
                borderTop: `1px solid rgba(${T},0.12)`,
                paddingTop: 24,
              }}
            >
              {STATS.map((s) => (
                <div
                  key={s.v}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                  }}
                >
                  <span
                    style={{
                      fontSize: 15.5,
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color: ACCENT_LIGHT,
                    }}
                  >
                    {s.k}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: `rgba(${T},0.42)`,
                    }}
                  >
                    {s.v}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="dp-hero-visual">
            <div
              data-reveal
              style={{
                width: "100%",
                aspectRatio: "4 / 5",
                border: `1px solid rgba(${A},0.35)`,
                background: `linear-gradient(160deg, rgba(${A},0.08), rgba(10,14,20,0.35) 60%)`,
                boxShadow: `0 30px 90px -46px rgba(${A},0.5)`,
                borderRadius: 20,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- external R2 asset, no next.config remotePatterns entry needed */}
              <img
                src={PASSPORT_SCREENSHOT_URL}
                alt="SpaceSnap Digital Passport — certifications, proficiency badges and training record"
                width={880}
                height={1100}
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* What's inside */}
      <section className="dp-pad dp-section">
        <div
          data-reveal
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <h2
            className="dp-h2"
            style={{
              lineHeight: 1.04,
              letterSpacing: "-0.038em",
              fontWeight: 900,
              margin: 0,
            }}
          >
            What&apos;s inside
          </h2>
          <p
            style={{
              fontSize: 16.5,
              color: `rgba(${T},0.52)`,
              margin: 0,
              maxWidth: "42ch",
              lineHeight: 1.55,
            }}
          >
            Every entry carries who issued it, when, and when it expires.
            Nothing self-declared.
          </p>
        </div>
        <div style={{ borderTop: `1px solid rgba(${T},0.14)` }}>
          {CREDENTIALS.map((c) => (
            <div
              key={c.num}
              data-reveal
              className="dp-cred-row"
              style={{
                display: "grid",
                gridTemplateColumns: "64px minmax(200px, 0.9fr) 1.5fr 150px",
                gap: 32,
                alignItems: "start",
                padding: "32px 0 34px",
                borderBottom: `1px solid rgba(${T},0.1)`,
                transition: "background 260ms ease",
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12.5,
                  color: `rgba(${T},0.35)`,
                  paddingTop: 6,
                }}
              >
                {c.num}
              </span>
              <h3
                style={{
                  fontSize: 25,
                  fontWeight: 800,
                  letterSpacing: "-0.026em",
                  lineHeight: 1.16,
                  margin: 0,
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  fontSize: 16.5,
                  lineHeight: 1.6,
                  color: `rgba(${T},0.62)`,
                  margin: 0,
                  textWrap: "pretty",
                }}
              >
                {c.body}
              </p>
              <span
                className="dp-cred-issuer"
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                  color: `rgba(${T},0.5)`,
                  textAlign: "right",
                  paddingTop: 7,
                  lineHeight: 1.5,
                }}
              >
                issued by
                <br />
                <span style={{ color: ACCENT }}>{c.issuer}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* The difference it makes */}
      <section
        className="dp-diff"
        style={{
          position: "relative",
          background: "#0b1017",
          borderTop: `1px solid rgba(${T},0.1)`,
          borderBottom: `1px solid rgba(${T},0.1)`,
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -260,
            right: -120,
            width: 900,
            height: 900,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 50%, rgba(${A},0.22), rgba(${A},0.07) 44%, rgba(${A},0) 72%)`,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
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
              marginBottom: 22,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: ACCENT,
                boxShadow: `0 0 12px ${ACCENT}`,
                animation: "ss-pulse-glow 2s ease-in-out infinite",
              }}
            />
            The difference it makes
          </div>
          <h2
            data-reveal
            className="dp-h2"
            style={{
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              fontWeight: 900,
              margin: "0 0 48px",
              maxWidth: "24ch",
              textWrap: "balance",
            }}
          >
            The same competence.
            <span
              style={{
                color: ACCENT,
                textShadow: `0 0 36px rgba(${A},0.5)`,
              }}
            >
              {" "}
              A fraction of the friction.
            </span>
          </h2>
          <div className="dp-compare-grid">
            {/* Before */}
            <div
              data-reveal
              style={{
                border: `1px solid rgba(${T},0.1)`,
                background: "rgba(10,14,20,0.55)",
                padding: "36px 34px 38px",
                borderRadius: 20,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 11.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: `rgba(${T},0.4)`,
                  marginBottom: 26,
                }}
              >
                Traditional onboarding
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 15,
                }}
              >
                {BEFORE.map((b) => (
                  <div
                    key={b}
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: 15,
                        height: 1,
                        background: `rgba(${T},0.25)`,
                        marginTop: 13,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 16.5,
                        lineHeight: 1.5,
                        color: `rgba(${T},0.5)`,
                      }}
                    >
                      {b}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 32,
                  paddingTop: 22,
                  borderTop: `1px solid rgba(${T},0.1)`,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                    color: `rgba(${T},0.5)`,
                  }}
                >
                  Weeks
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: `rgba(${T},0.35)`,
                  }}
                >
                  time to bench
                </span>
              </div>
            </div>
            {/* After */}
            <div
              data-reveal
              style={{
                position: "relative",
                border: `1px solid rgba(${A},0.5)`,
                background: `linear-gradient(165deg, rgba(${A},0.15), rgba(10,14,20,0.4) 62%)`,
                padding: "36px 34px 38px",
                borderRadius: 20,
                boxShadow: `0 34px 100px -40px rgba(${A},0.75), inset 0 0 90px rgba(${A},0.06)`,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 11.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: ACCENT,
                  marginBottom: 26,
                }}
              >
                With a Digital Passport
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 15,
                }}
              >
                {AFTER.map((a) => (
                  <div
                    key={a}
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: 15,
                        height: 1,
                        background: ACCENT,
                        boxShadow: `0 0 10px rgba(${A},0.9)`,
                        marginTop: 13,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 16.5,
                        lineHeight: 1.5,
                        color: `rgba(${T},0.9)`,
                      }}
                    >
                      {a}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 32,
                  paddingTop: 22,
                  borderTop: `1px solid rgba(${A},0.3)`,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                    color: ACCENT,
                    textShadow: `0 0 28px rgba(${A},0.6)`,
                  }}
                >
                  Same day
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: `rgba(${T},0.5)`,
                  }}
                >
                  time to bench
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / sign-up band */}
      <section
        id="signup"
        data-reveal
        className="dp-cta"
        style={{
          background: `linear-gradient(150deg, ${ACCENT_LIGHT}, ${ACCENT} 45%, ${ACCENT_DEEP})`,
          color: "#04100c",
          display: "flex",
          flexWrap: "wrap",
          gap: 48,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2
            className="dp-cta-h"
            style={{
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              fontWeight: 900,
              margin: "0 0 14px",
              maxWidth: "24ch",
              textWrap: "balance",
            }}
          >
            Start your passport. It follows you from here.
          </h2>
          <p
            style={{
              fontSize: 17.5,
              lineHeight: 1.5,
              margin: 0,
              color: "rgba(4,16,12,0.7)",
              maxWidth: "48ch",
            }}
          >
            Create an account, add your first sign-off, and every space you book
            after that gets shorter.
          </p>
        </div>
        <Link
          href="/signup"
          className="dp-cta-btn"
          style={{
            background: "#04100c",
            color: ACCENT,
            padding: "22px 36px",
            borderRadius: 999,
            fontSize: 16.5,
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            whiteSpace: "nowrap",
            transition: "transform 260ms ease",
          }}
        >
          Sign up free <span>→</span>
        </Link>
      </section>
    </main>
  );
}

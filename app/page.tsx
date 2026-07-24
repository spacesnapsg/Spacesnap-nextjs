import Image from "next/image";
import Link from "next/link";
import { Home as HomeIcon, Zap, CheckCircle } from "lucide-react";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";

const CTA_CLASSES =
  "inline-flex items-center justify-center h-12 px-8 rounded-full font-semibold text-sm uppercase tracking-wide transition-shadow bg-user-teal-end text-white ring-[5px] ring-[rgba(27,158,152,0.1)] shadow-[0_0_0_rgba(0,255,179,0)] hover:shadow-[0_0_24px_12px_rgba(0,255,179,0.3)]";

const BENEFITS = [
  {
    icon: HomeIcon,
    title: "Booking",
    description:
      "Book the session, not the year. Reserve the space or instrument you need for exactly as long as you need it — and nothing more.",
  },
  {
    icon: Zap,
    title: "No Lock-in",
    description:
      "Pay for access, not ownership. Run your proof-of-concept, prove it works, then decide what's next.",
  },
  {
    icon: CheckCircle,
    title: "Verification",
    description:
      "Verified once, trusted everywhere. Your competencies live in a Digital Passport that unlocks access across facilities.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden bg-background text-body-text">
      <MarketingNavbar />

      <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-20 max-w-3xl mx-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-user-teal-start/10 to-transparent blur-3xl" />
        <h1 className="relative text-5xl sm:text-6xl font-medium tracking-tight text-white leading-tight">
          You have the idea. The infrastructure supports you.
        </h1>
        <p className="relative mt-6 text-lg text-muted-text max-w-xl">
          On-demand access to professional spaces and high-value equipment —
          verified, bookable, and ready when you are. No capital outlay, no
          landlord contracts, just the access you need to test what&apos;s
          next.
        </p>
        <Link href="/signup" className={`relative mt-8 ${CTA_CLASSES}`}>
          Claim Founding Access
        </Link>
      </section>

      <section className="relative bg-background pt-12 pb-32 px-6 flex justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-[100px] w-[1066px] max-w-[95vw] h-[400px]"
        >
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-[80px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #34d399 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-x-[15%] inset-y-[30%] rounded-full opacity-20 blur-[20px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #34d399 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-4 opacity-80 blur-[45px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #ffffff 0%, #34d399 40%, transparent 80%)",
            }}
          />
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px opacity-90 mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to right, transparent, #ffffff, transparent)",
            }}
          />
        </div>
        <p className="relative max-w-3xl text-2xl sm:text-3xl md:text-4xl font-medium leading-snug text-white text-center">
          The hardest part of a good idea isn&apos;t the idea. It&apos;s the
          friction of proving it.
        </p>
      </section>

      <section className="px-6 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-medium text-white">
            What is SpaceSnap?
          </h2>
          <p className="mt-6 text-muted-text">
            We&apos;re building SpaceSnap in Singapore — credential-gated
            access to shared lab and food-tech spaces, so members skip the
            capex and operators skip the liability risk.
          </p>
          <p className="mt-4 text-muted-text">
            We&apos;re early — currently building out our first pilot
            partnerships. Questions? Reach us at{" "}
            <a
              href="mailto:spacesnapsg@gmail.com"
              className="text-user-teal-end underline"
            >
              spacesnapsg@gmail.com
            </a>
            .
          </p>
        </div>
      </section>

      <section className="px-6 py-20 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-user-teal-end">
            <span className="inline-block w-1 h-3.5 bg-user-teal-end" />
            Benefits
          </p>
          <h2 className="mt-2 text-3xl font-medium text-white">
            Why join SpaceSnap?
          </h2>
          <p className="mt-3 text-muted-text max-w-xl">
            SpaceSnap is designed to provide a seamless, secure, and
            accessible experience for all members.
          </p>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, description }) => (
              <div key={title}>
                <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-muted-text">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-card px-6 py-12 md:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-1"
        >
          <div
            className="absolute inset-x-0 -top-16 h-32 opacity-30 blur-[80px] mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to right, transparent, #34d399 50%, transparent)",
            }}
          />
          <div
            className="absolute inset-x-[15%] -top-4 h-8 opacity-20 blur-[20px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #34d399 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-x-0 h-4 -translate-y-1/2 opacity-80 blur-[45px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #ffffff 0%, #34d399 40%, transparent 80%)",
            }}
          />
          <div
            className="absolute inset-x-0 h-px opacity-90 mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to right, transparent, #ffffff, transparent)",
            }}
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-1"
        >
          <div
            className="absolute inset-x-0 -bottom-16 h-32 opacity-30 blur-[80px] mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to right, transparent, #34d399 50%, transparent)",
            }}
          />
          <div
            className="absolute inset-x-[15%] -bottom-4 h-8 opacity-20 blur-[20px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #34d399 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-x-0 h-4 translate-y-1/2 opacity-80 blur-[45px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #ffffff 0%, #34d399 40%, transparent 80%)",
            }}
          />
          <div
            className="absolute inset-x-0 h-px opacity-90 mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to right, transparent, #ffffff, transparent)",
            }}
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1"
        >
          <div
            className="absolute inset-y-0 left-0 -translate-x-16 w-32 opacity-30 blur-[80px] mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #34d399 50%, transparent)",
            }}
          />
          <div
            className="absolute inset-y-[15%] left-0 -translate-x-4 w-8 opacity-20 blur-[20px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #34d399 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-y-0 left-0 w-4 -translate-x-1/2 opacity-80 blur-[45px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #ffffff 0%, #34d399 40%, transparent 80%)",
            }}
          />
          <div
            className="absolute inset-y-0 left-0 w-px opacity-90 mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #ffffff, transparent)",
            }}
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -right-1"
        >
          <div
            className="absolute inset-y-0 right-0 translate-x-16 w-32 opacity-30 blur-[80px] mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #34d399 50%, transparent)",
            }}
          />
          <div
            className="absolute inset-y-[15%] right-0 translate-x-4 w-8 opacity-20 blur-[20px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #34d399 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-4 translate-x-1/2 opacity-80 blur-[45px] mix-blend-lighten"
            style={{
              background:
                "radial-gradient(ellipse at center, #ffffff 0%, #34d399 40%, transparent 80%)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-px opacity-90 mix-blend-lighten"
            style={{
              background:
                "linear-gradient(to bottom, transparent, #ffffff, transparent)",
            }}
          />
        </div>
        <div className="relative max-w-6xl mx-auto">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-user-teal-end">
            <span className="inline-block w-1 h-3.5 bg-user-teal-end" />
            Founding Offer
          </p>
          <h2 className="mt-3 text-2xl md:text-3xl font-medium text-white">
            Founding members get in first — and cheaper.
          </h2>
          <p className="mt-4 text-muted-text max-w-2xl">
            Join now and you&apos;ll get founding-member credits toward your
            first bookings, early access ahead of public launch, and a direct
            line to shape which equipment and facilities we bring on. Tell us
            what you need, and we&apos;ll build the access around it.
          </p>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div className="relative h-64 md:h-80 rounded-card overflow-hidden">
            <Image
              src="/green-lab.jpg.webp"
              alt="Shared lab space"
              fill
              className="object-cover"
            />
          </div>
          <div className="text-center md:text-left flex flex-col items-center md:items-start">
            <h2 className="text-3xl font-medium text-white">
              Skip the friction, get in before the launch.
            </h2>
            <p className="mt-4 text-muted-text max-w-md">
              Have a friend? Refer them too — work on a project together.
            </p>
            <Link href="/signup" className={`inline-flex mt-8 ${CTA_CLASSES}`}>
              Claim Founding Access
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

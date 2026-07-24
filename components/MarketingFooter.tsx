import Image from "next/image";
import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  YoutubeIcon,
  XIcon,
} from "./SocialIcons";

// TODO: swap these placeholder "#" targets for SpaceSnap's real profile
// URLs once they exist — never fabricate a brand's social link.
const SOCIAL_LINKS = [
  { label: "Facebook", href: "#", Icon: FacebookIcon },
  { label: "X", href: "#", Icon: XIcon },
  { label: "Instagram", href: "#", Icon: InstagramIcon },
  { label: "LinkedIn", href: "#", Icon: LinkedinIcon },
  { label: "YouTube", href: "#", Icon: YoutubeIcon },
];

const PLATFORM_LINKS = [
  { label: "Marketplace", href: "/platform/marketplace" },
  { label: "Digital Passport", href: "/platform/digital-passport" },
];

const SOLUTIONS_LINKS = [
  { label: "For Startups", href: "/solutions/startups" },
  { label: "For Space Providers", href: "/solutions/space-providers" },
  { label: "For Suppliers", href: "/solutions/suppliers" },
];

export default function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-border px-6 py-16">
      <div className="max-w-7xl mx-auto grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="lg:col-span-1">
          <Image
            src="/logos/spacesnap-wordmark-transparent.png"
            alt="SpaceSnap"
            width={1403}
            height={274}
            className="h-9 w-auto"
          />
          <p className="mt-4 text-sm text-hint-text max-w-xs">
            SpaceSnap is your all-in-one platform for on-demand access to
            shared lab and food-tech spaces — book by the session, skip the
            capex.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Platform</h3>
          <ul className="mt-4 space-y-3">
            {PLATFORM_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-muted-text hover:text-white transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Solutions</h3>
          <ul className="mt-4 space-y-3">
            {SOLUTIONS_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-muted-text hover:text-white transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Get in touch</h3>
          <a
            href="mailto:spacesnapsg@gmail.com"
            className="mt-4 block text-sm text-muted-text hover:text-white transition-colors"
          >
            spacesnapsg@gmail.com
          </a>
          <Link
            href="/signup"
            className="mt-4 inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-semibold bg-white text-background hover:bg-white/90 transition-colors"
          >
            Newsletter Sign Up
          </Link>
          <div className="mt-5 flex items-center gap-3">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-text hover:text-white hover:border-user-teal-end transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

import { ShieldCheck, Forklift, Flame, FlaskConical, Cog, Award, type LucideIcon } from "lucide-react";

// Certificate.icon (lib/certificates.ts) is a free-form nullable string, not
// an enum — the Add Certificate form doesn't even expose an icon field, so
// most admin/supplier-created certs have icon: null. Only the seeded
// certificates (prisma/seed.ts) currently set one. Falls back to a generic
// badge for null/unrecognized values rather than rendering the raw string.
const CERTIFICATE_ICON_MAP: Record<string, LucideIcon> = {
  "shield-check": ShieldCheck,
  forklift: Forklift,
  flame: Flame,
  "flask-conical": FlaskConical,
  cog: Cog,
};

export default function CertificateIcon({
  icon,
  size,
  className,
}: {
  icon: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const Icon = (icon ? CERTIFICATE_ICON_MAP[icon] : undefined) ?? Award;
  return <Icon size={size} className={className} />;
}

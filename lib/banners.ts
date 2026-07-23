import { BannerPortal, type Banner } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/storage";

export function serializeBanner(banner: Banner) {
  return {
    id: banner.id.toString(),
    portal: banner.portal,
    imageUrl: getPublicAssetUrl(banner.imageKey),
    expiresAt: banner.expiresAt ? banner.expiresAt.toISOString() : null,
    updatedAt: banner.updatedAt.toISOString(),
  };
}

// null if no banner is configured for this portal OR the configured one is
// past its expiry — enforced here, server-side, so the client never has to
// special-case an expired banner itself (mirrors getAvailableCreditBalance's
// "resolve the real-world state here, not at every call site" discipline).
export async function getActiveBanner(portal: BannerPortal) {
  const banner = await prisma.banner.findUnique({ where: { portal } });
  if (!banner) return null;
  if (banner.expiresAt && banner.expiresAt < new Date()) return null;
  return serializeBanner(banner);
}

export async function setBanner(params: {
  portal: BannerPortal;
  imageKey: string;
  expiresAt: Date | null;
  updatedByUserId: string;
}) {
  const banner = await prisma.banner.upsert({
    where: { portal: params.portal },
    create: {
      portal: params.portal,
      imageKey: params.imageKey,
      expiresAt: params.expiresAt,
      updatedByUserId: params.updatedByUserId,
    },
    update: {
      imageKey: params.imageKey,
      expiresAt: params.expiresAt,
      updatedByUserId: params.updatedByUserId,
    },
  });
  return serializeBanner(banner);
}

export function parseBannerPortal(value: unknown): BannerPortal | null {
  if (value === "member" || value === "supplier") return value;
  return null;
}

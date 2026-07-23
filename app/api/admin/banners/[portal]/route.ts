import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { validationErrorResponse, ApiValidationError, notFoundResponse } from "@/lib/api-errors";
import { setBanner, parseBannerPortal, serializeBanner } from "@/lib/banners";
import { prisma } from "@/lib/prisma";

// Admin GET returns the raw configured banner (even if expired, so the
// admin can see and replace a stale one) — distinct from the public
// GET /api/banners/[portal], which hides expired ones.
export async function GET(request: NextRequest, { params }: { params: Promise<{ portal: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { portal } = await params;
  const parsed = parseBannerPortal(portal);
  if (parsed === null) return notFoundResponse("Unknown portal.");

  const banner = await prisma.banner.findUnique({ where: { portal: parsed } });
  return NextResponse.json({ banner: banner ? serializeBanner(banner) : null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ portal: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { portal } = await params;
  const parsedPortal = parseBannerPortal(portal);
  if (parsedPortal === null) return notFoundResponse("Unknown portal.");

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (typeof b.imageKey !== "string" || b.imageKey.length === 0) {
    return validationErrorResponse(new ApiValidationError({ imageKey: ["imageKey is required — upload an image first."] }));
  }

  let expiresAt: Date | null = null;
  if (typeof b.expiresAt === "string" && b.expiresAt.length > 0) {
    const parsed = new Date(b.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return validationErrorResponse(new ApiValidationError({ expiresAt: ["expiresAt must be a valid date."] }));
    }
    expiresAt = parsed;
  }

  const banner = await setBanner({ portal: parsedPortal, imageKey: b.imageKey, expiresAt, updatedByUserId: auth.userId });
  return NextResponse.json({ banner });
}

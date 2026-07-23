import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { ApiValidationError, validationErrorResponse, notFoundResponse } from "@/lib/api-errors";
import { parseBannerPortal } from "@/lib/banners";
import { buildPublicAssetKey, getPublicAssetUploadUrl } from "@/lib/storage";

const ALLOWED_CONTENT_TYPE_PREFIX = "image/";

export async function POST(request: NextRequest, { params }: { params: Promise<{ portal: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { portal } = await params;
  if (parseBannerPortal(portal) === null) return notFoundResponse("Unknown portal.");

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const filename = typeof b.filename === "string" ? b.filename : null;
  const contentType = typeof b.contentType === "string" ? b.contentType : null;

  if (!filename || !contentType || !contentType.startsWith(ALLOWED_CONTENT_TYPE_PREFIX)) {
    return validationErrorResponse(new ApiValidationError({ contentType: ["filename is required and contentType must be an image/* mime type."] }));
  }

  const key = buildPublicAssetKey({ scope: "banner", filename });
  const uploadUrl = await getPublicAssetUploadUrl({ key, contentType });
  return NextResponse.json({ uploadUrl, key });
}

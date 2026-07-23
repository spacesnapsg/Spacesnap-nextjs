import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import { buildPublicAssetKey, getPublicAssetUploadUrl } from "@/lib/storage";

const ALLOWED_CONTENT_TYPE_PREFIX = "image/";

export async function POST(request: NextRequest) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const filename = typeof b.filename === "string" ? b.filename : null;
  const contentType = typeof b.contentType === "string" ? b.contentType : null;

  if (!filename || !contentType || !contentType.startsWith(ALLOWED_CONTENT_TYPE_PREFIX)) {
    return validationErrorResponse(new ApiValidationError({ contentType: ["filename is required and contentType must be an image/* mime type."] }));
  }

  const key = buildPublicAssetKey({ scope: "edm/supplier", filename, companyId: auth.companyId });
  const uploadUrl = await getPublicAssetUploadUrl({ key, contentType });
  return NextResponse.json({ uploadUrl, key });
}

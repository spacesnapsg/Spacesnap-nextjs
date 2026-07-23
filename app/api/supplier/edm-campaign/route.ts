import { NextRequest, NextResponse } from "next/server";
import { requireSupplier, requireCompanyAdmin } from "@/lib/supplier-auth";
import { validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { getSupplierEdmCampaign, setSupplierEdmCampaign, serializeSupplierEdmCampaign } from "@/lib/edm-campaigns";

// Read is any team member (requireSupplier) — matches the same gate the
// existing listing create/edit routes use. The mutation below is stricter
// (requireCompanyAdmin), by direct analogy to updateCompanyBusinessDetails
// — the only existing "one supplier edits something company-wide"
// precedent. Not explicitly specified by the product owner; worth a quick
// confirm rather than treated as settled.
export async function GET() {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const campaign = await getSupplierEdmCampaign(auth.companyId);
  return NextResponse.json({ campaign: campaign ? serializeSupplierEdmCampaign(campaign) : null });
}

export async function PUT(request: NextRequest) {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (typeof b.imageKey !== "string" || b.imageKey.length === 0) {
    return validationErrorResponse(new ApiValidationError({ imageKey: ["imageKey is required — upload an image first."] }));
  }

  const campaign = await setSupplierEdmCampaign({
    companyId: auth.companyId,
    imageKey: b.imageKey,
    caption: typeof b.caption === "string" && b.caption.trim().length > 0 ? b.caption.trim() : null,
    createdByUserId: auth.userId,
  });

  return NextResponse.json({ campaign: serializeSupplierEdmCampaign(campaign) });
}

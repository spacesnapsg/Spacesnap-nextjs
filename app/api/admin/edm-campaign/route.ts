import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { getAdminEdmCampaign, setAdminEdmCampaign, serializeAdminEdmCampaign } from "@/lib/edm-campaigns";

export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const campaign = await getAdminEdmCampaign();
  return NextResponse.json({ campaign: campaign ? serializeAdminEdmCampaign(campaign) : null });
}

export async function PUT(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  if (typeof b.imageKey !== "string" || b.imageKey.length === 0) {
    return validationErrorResponse(new ApiValidationError({ imageKey: ["imageKey is required — upload an image first."] }));
  }
  const targetMembers = b.targetMembers === true;
  const targetSuppliers = b.targetSuppliers === true;
  if (!targetMembers && !targetSuppliers) {
    return validationErrorResponse(new ApiValidationError({ audience: ["Select at least one audience (Members or Suppliers)."] }));
  }

  const campaign = await setAdminEdmCampaign({
    imageKey: b.imageKey,
    caption: typeof b.caption === "string" && b.caption.trim().length > 0 ? b.caption.trim() : null,
    targetMembers,
    targetSuppliers,
    createdByUserId: auth.userId,
  });

  return NextResponse.json({ campaign: serializeAdminEdmCampaign(campaign) });
}

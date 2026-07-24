import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import {
  resolveMarketplaceEnquiry,
  MarketplaceEnquiryResolutionError,
  serializeMarketplaceEnquiry,
} from "@/lib/marketplace-enquiries";

// System-admin-only. Marks a pending enquiry as fulfilled once the admin has
// handled it out-of-platform (see lib/marketplace-enquiries.ts).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const enquiryId = parseBigIntParam(id);
  if (enquiryId === null) return notFoundResponse("Enquiry not found.");

  const body = await request.json().catch(() => null);
  const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined;
  if (status !== "fulfilled") {
    return validationErrorResponse(new ApiValidationError({ status: ['status must be "fulfilled".'] }));
  }

  try {
    const enquiry = await resolveMarketplaceEnquiry(enquiryId, auth.userId);
    return NextResponse.json({ enquiry: serializeMarketplaceEnquiry(enquiry) });
  } catch (error) {
    if (error instanceof MarketplaceEnquiryResolutionError) {
      if (error.reason === "not_found") return notFoundResponse(error.message);
      return validationErrorResponse(new ApiValidationError({ status: [error.message] }));
    }
    throw error;
  }
}

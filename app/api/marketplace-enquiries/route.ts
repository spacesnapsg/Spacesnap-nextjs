import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { unauthorizedResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { createMarketplaceEnquiry, serializeMarketplaceEnquiry } from "@/lib/marketplace-enquiries";

// Any authenticated user — backs components/CustomRequirementsModal.tsx's
// "Submit Membership Inquiry" / "Request Consultation" forms.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const body = await request.json().catch(() => null);
  const type = body && typeof body === "object" ? (body as Record<string, unknown>).type : undefined;
  const details = body && typeof body === "object" ? (body as Record<string, unknown>).details : undefined;
  const contactEmail = body && typeof body === "object" ? (body as Record<string, unknown>).contactEmail : undefined;

  if (type !== "membership" && type !== "consultancy") {
    return validationErrorResponse(new ApiValidationError({ type: ['type must be "membership" or "consultancy".'] }));
  }
  if (typeof details !== "string" || !details.trim()) {
    return validationErrorResponse(new ApiValidationError({ details: ["Please describe what you need."] }));
  }

  try {
    const enquiry = await createMarketplaceEnquiry(
      session.user.id,
      type,
      details,
      typeof contactEmail === "string" ? contactEmail : undefined
    );
    return NextResponse.json({ enquiry: serializeMarketplaceEnquiry(enquiry) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}

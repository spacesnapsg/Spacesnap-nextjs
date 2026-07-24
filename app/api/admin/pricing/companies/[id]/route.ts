import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { updateCompanyPricingOverrides, listCompanyPricingOverrides } from "@/lib/pricing";

// System-admin-only. Sets/clears one company's per-supplier pricing overrides.
// A field set to null reverts it to the platform default; an omitted field is
// left unchanged.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const companyId = parseBigIntParam(id);
  if (companyId === null) return notFoundResponse("Company not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ body: ["Request body must be an object."] }));
  }

  try {
    await updateCompanyPricingOverrides(companyId, body as Record<string, unknown>);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const companies = await listCompanyPricingOverrides();
  const updated = companies.find((c) => c.companyId === companyId.toString());
  if (!updated) return notFoundResponse("Company not found.");
  return NextResponse.json({ company: updated });
}

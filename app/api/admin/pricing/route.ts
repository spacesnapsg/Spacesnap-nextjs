import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { ApiValidationError, validationErrorResponse } from "@/lib/api-errors";
import {
  getPlatformPricingConfig,
  updatePlatformPricingConfig,
  listCompanyPricingOverrides,
  serializePlatformPricingConfig,
} from "@/lib/pricing";

// System-admin-only. Backs the "Pricing & Commission" panel on the admin
// Financials page: the platform-wide defaults plus every company's per-supplier
// overrides. Suppliers have no access to any of this.
export async function GET() {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const [config, companies] = await Promise.all([getPlatformPricingConfig(), listCompanyPricingOverrides()]);
  return NextResponse.json({ config: serializePlatformPricingConfig(config), companies });
}

// System-admin-only. Updates any subset of the platform default rates.
export async function PATCH(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ body: ["Request body must be an object."] }));
  }

  try {
    const config = await updatePlatformPricingConfig(body as Record<string, unknown>);
    return NextResponse.json({ config: serializePlatformPricingConfig(config) });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}

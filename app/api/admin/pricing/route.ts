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
// overrides (searchable + paginated — see listCompanyPricingOverrides).
// Suppliers have no access to any of this.
export async function GET(request: NextRequest) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [config, { companies, meta }] = await Promise.all([
    getPlatformPricingConfig(),
    listCompanyPricingOverrides({ search, page }),
  ]);
  return NextResponse.json({ config: serializePlatformPricingConfig(config), companies, meta });
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

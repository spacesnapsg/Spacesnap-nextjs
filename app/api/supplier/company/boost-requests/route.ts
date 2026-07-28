import { NextRequest, NextResponse } from "next/server";
import { CompanyBoostRequestStatus } from "@/app/generated/prisma/client";
import { requireCompanyAdmin, requireSupplier } from "@/lib/supplier-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import {
  createCompanyBoostRequest,
  getCompanyBoostRequestById,
  getCompanyBoostRequests,
  parseCompanyBoostRequestFields,
  serializeCompanyBoostRequest,
  ListingNotFoundError,
} from "@/lib/company-boost-requests";

const STATUSES = new Set<string>(Object.values(CompanyBoostRequestStatus));

// GET: the company admin's own queue — same "?status= filters, defaults to
// everything so history is visible too" idiom as
// GET /api/buyer-organization/spend-requests.
export async function GET(request: NextRequest) {
  const authResult = await requireCompanyAdmin();
  if ("error" in authResult) return authResult.error;

  const status = new URL(request.url).searchParams.get("status");
  if (status && !STATUSES.has(status)) {
    return NextResponse.json({ message: "status must be one of pending, fulfilled, declined." }, { status: 422 });
  }

  const requests = await getCompanyBoostRequests(authResult.companyId, status as CompanyBoostRequestStatus | undefined);
  return NextResponse.json({ requests: requests.map(serializeCompanyBoostRequest) });
}

// POST: any company member asks their admin to spend company funds on the
// Boost catalogue — see lib/company-boost-requests.ts's own comment for the
// full lifecycle.
export async function POST(request: NextRequest) {
  const authResult = await requireSupplier();
  if ("error" in authResult) return authResult.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseCompanyBoostRequestFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  try {
    const created = await createCompanyBoostRequest(authResult.userId, authResult.companyId, fields);
    const full = await getCompanyBoostRequestById(created.id);
    return NextResponse.json({ request: serializeCompanyBoostRequest(full!) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof ListingNotFoundError) return notFoundResponse(error.message);
    throw error;
  }
}

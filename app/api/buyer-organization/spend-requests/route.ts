import { NextRequest, NextResponse } from "next/server";
import { BuyerOrgSpendRequestStatus } from "@/app/generated/prisma/client";
import { requireBuyerOrgAdmin, requireBuyerOrgMember } from "@/lib/buyer-org-auth";
import { ApiValidationError, notFoundResponse, validationErrorResponse } from "@/lib/api-errors";
import {
  createBuyerOrgSpendRequest,
  getBuyerOrgSpendRequestById,
  getBuyerOrgSpendRequests,
  parseSpendRequestFields,
  serializeBuyerOrgSpendRequest,
} from "@/lib/buyer-org-spend-requests";
import { ListingNotFoundError } from "@/lib/listings";

const STATUSES = new Set<string>(Object.values(BuyerOrgSpendRequestStatus));

// GET: the org admin's own queue — same "?status= filters, defaults to
// everything so history is visible too" idiom as
// GET /api/supplier/certificate-signoff-requests.
export async function GET(request: NextRequest) {
  const authResult = await requireBuyerOrgAdmin();
  if ("error" in authResult) return authResult.error;

  const status = new URL(request.url).searchParams.get("status");
  if (status && !STATUSES.has(status)) {
    return NextResponse.json({ message: "status must be one of pending, fulfilled, declined." }, { status: 422 });
  }

  const requests = await getBuyerOrgSpendRequests(
    authResult.buyerOrganizationId,
    status as BuyerOrgSpendRequestStatus | undefined
  );
  return NextResponse.json({ requests: requests.map(serializeBuyerOrgSpendRequest) });
}

// POST: any org member asks their admin to fund a booking/Buy Now purchase
// from the shared pool — see lib/buyer-org-spend-requests.ts's own comment
// for the full lifecycle.
export async function POST(request: NextRequest) {
  const authResult = await requireBuyerOrgMember();
  if ("error" in authResult) return authResult.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 422 });
  }

  let fields;
  try {
    fields = parseSpendRequestFields(body);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  try {
    const created = await createBuyerOrgSpendRequest(authResult.userId, authResult.buyerOrganizationId, fields);
    const full = await getBuyerOrgSpendRequestById(created.id);
    return NextResponse.json({ request: serializeBuyerOrgSpendRequest(full!) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof ListingNotFoundError) return notFoundResponse(error.message);
    throw error;
  }
}

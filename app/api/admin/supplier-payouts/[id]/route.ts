import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin-auth";
import { notFoundResponse, validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseBigIntParam } from "@/lib/listings";
import { setSupplierPayoutBillUrl, markSupplierPayoutPaid, serializeSupplierPayout, SupplierPayoutError } from "@/lib/supplier-payouts";

// System-admin-only. Two actions on an already-billed SupplierPayout:
//   - { xeroBillUrl } sets/updates the Bill link (see setSupplierPayoutBillUrl).
//   - { status: "paid", xeroRemittanceUrl } confirms the transfer and
//     attaches the Remittance Advice link (see markSupplierPayoutPaid).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const payoutId = parseBigIntParam(id);
  if (payoutId === null) return notFoundResponse("Payout not found.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return validationErrorResponse(new ApiValidationError({ body: ["Request body must be an object."] }));
  }
  const { status, xeroBillUrl, xeroRemittanceUrl } = body as Record<string, unknown>;

  try {
    if (status === "paid") {
      const payout = await markSupplierPayoutPaid(payoutId, xeroRemittanceUrl);
      return NextResponse.json({ payout: serializeSupplierPayout(payout) });
    }
    if (status !== undefined) {
      return validationErrorResponse(new ApiValidationError({ status: ['status must be "paid" if provided.'] }));
    }
    const payout = await setSupplierPayoutBillUrl(payoutId, xeroBillUrl);
    return NextResponse.json({ payout: serializeSupplierPayout(payout) });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    if (error instanceof SupplierPayoutError) {
      if (error.reason === "not_found") return notFoundResponse(error.message);
      return validationErrorResponse(new ApiValidationError({ status: [error.message] }));
    }
    throw error;
  }
}

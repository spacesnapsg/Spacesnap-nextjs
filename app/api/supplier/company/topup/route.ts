import { NextRequest, NextResponse } from "next/server";
import { requireSupplier } from "@/lib/supplier-auth";
import { validationErrorResponse, ApiValidationError } from "@/lib/api-errors";
import { parseCompanyTopUpAmount, createCompanyTopUp } from "@/lib/company-credits";
import { sgdToCredits } from "@/lib/credit-units";

// Any company member can top up the shared company wallet — confirmed with
// the product owner 2026-07-22 (no isCompanyAdmin-only gate, mirroring the
// "no separate purchaser role" decision on the BuyerOrganization thread).
// requireSupplier() already allows any supplier at the company, not just an
// admin — the right gate as-is, no new auth helper needed.
export async function POST(request: NextRequest) {
  const auth = await requireSupplier();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);

  try {
    const amount = parseCompanyTopUpAmount(body);
    const { transaction, balance } = await createCompanyTopUp(auth.companyId, auth.userId, amount);

    return NextResponse.json({
      transaction: {
        id: transaction.id.toString(),
        type: transaction.type,
        amount: sgdToCredits(Number(transaction.amount)),
        createdAt: transaction.createdAt.toISOString(),
      },
      purchasedCredits: sgdToCredits(Number(balance)),
    });
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }
}

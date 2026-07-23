import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ApiValidationError, unauthorizedResponse, validationErrorResponse } from "@/lib/api-errors";
import { parseActivityQuery } from "@/lib/activity";
import { getWalletTransactionsPage, serializeWalletTransaction } from "@/lib/wallet-transactions";

// GET: the caller's own wallet transaction feed, paginated (10/page) with
// from/to date filtering — backs the Financials page's "Recent
// Transactions" card. Separate from GET /api/wallet's own bundled
// `transactions` field, see lib/wallet-transactions.ts's comment for why.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  let query;
  try {
    query = parseActivityQuery(new URL(request.url).searchParams);
  } catch (error) {
    if (error instanceof ApiValidationError) return validationErrorResponse(error);
    throw error;
  }

  const { items, total, page, pageSize } = await getWalletTransactionsPage(session.user.id, query);

  return NextResponse.json({
    transactions: items.map(serializeWalletTransaction),
    meta: { page, pageSize, total },
  });
}

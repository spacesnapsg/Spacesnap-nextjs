import { NextResponse } from "next/server";
import { requireCompanyAdmin } from "@/lib/supplier-auth";
import { listSupplierPayoutsForCompany } from "@/lib/supplier-payouts";

// GET: the caller's own company's full SupplierPayout history — backs the
// Financials page's "Accounts Receivable, Receipts & Invoices" card.
// Company-admin-only, same reasoning as the transactions/payables routes
// (a financial ledger is an admin-level view).
export async function GET() {
  const auth = await requireCompanyAdmin();
  if ("error" in auth) return auth.error;

  const payouts = await listSupplierPayoutsForCompany(auth.companyId);
  return NextResponse.json({ payouts });
}

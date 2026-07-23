import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface WalletTransaction {
  id: string;
  type:
    | "booking"
    | "purchase"
    | "topup"
    | "refund"
    | "purchased_topup"
    | "purchased_spend"
    | "earned_grant"
    | "earned_spend"
    | "booking_payment"
    | "gig_payout_sgd"
    | "booking_modification_fee";
  amount: number;
  description: string;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  held: number;
  available: number;
  // Purchased/earned split (see lib/credits.ts) — purchased is spendable on
  // SpaceSnap's own goods/services (consumables, cert fees), earned is a
  // reward-credit position only ever usable as a discount. Both are
  // "credits" unit counts (lib/credit-units.ts), never a raw SGD figure.
  purchased: number;
  earned: number;
  // Flat, unpaginated (take-50) window used only for the Financials page's
  // derived stats (This Month's Spend, Avg Monthly Spend, Balance Trend) —
  // NOT the paginated "Recent Transactions" display list, see
  // useWalletTransactions below.
  transactions: WalletTransaction[];
}

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiFetch<Wallet>("/api/wallet"),
  });
}

export interface WalletTransactionsPageResult {
  transactions: WalletTransaction[];
  meta: { page: number; pageSize: number; total: number };
}

// Paginated (10/page), date-range-filterable — backs the Financials page's
// "Recent Transactions" card. Split out of useWallet's own bundled
// `transactions` (2026-07-23) so paging/date state doesn't disturb the
// broader window that page's derived stats need — see GET
// /api/wallet/transactions's own comment.
export function useWalletTransactions(dateRange: { from: string | null; to: string | null }, page: number) {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  params.set("page", String(page));

  return useQuery({
    queryKey: ["wallet-transactions", dateRange, page],
    queryFn: () => apiFetch<WalletTransactionsPageResult>(`/api/wallet/transactions?${params.toString()}`),
    placeholderData: (previousData) => previousData,
  });
}

export function useTopUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      apiFetch("/api/wallet/topup", { method: "POST", body: JSON.stringify({ amount }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
  });
}

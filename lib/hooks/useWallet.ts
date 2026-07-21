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
  transactions: WalletTransaction[];
}

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiFetch<Wallet>("/api/wallet"),
  });
}

export function useTopUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      apiFetch("/api/wallet/topup", { method: "POST", body: JSON.stringify({ amount }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

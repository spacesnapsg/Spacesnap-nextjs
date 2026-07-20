import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface WalletTransaction {
  id: string;
  type: "booking" | "purchase" | "topup" | "refund";
  amount: number;
  description: string;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  held: number;
  available: number;
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

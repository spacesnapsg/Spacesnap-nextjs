import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface BuyerOrganization {
  id: string;
  name: string;
  isAdmin: boolean;
  adminName: string | null;
  promotionRequested: boolean;
  // Delegated pool-spend rights (2026-07-28) — the caller's own effective
  // permission (already folds in "admins always have both").
  canBook: boolean;
  canPurchase: boolean;
  poolBalance: number;
}

export interface BuyerOrgMember {
  id: string;
  name: string;
  email: string;
  isBuyerOrgAdmin: boolean;
  buyerOrgCanBook: boolean;
  buyerOrgCanPurchase: boolean;
}

export interface BuyerOrgSpendRequest {
  id: string;
  type: "booking" | "consumable_purchase";
  status: "pending" | "fulfilled" | "declined";
  requestedBy: { id: string; name: string; email: string };
  listingId: string;
  listingName: string;
  bookingType: string | null;
  startDate: string | null;
  endDate: string | null;
  quantity: number | null;
  declineReason: string | null;
  createdAt: string;
}

export interface BuyerOrgJoinRequest {
  id: string;
  requestedBy: { id: string; name: string; email: string };
  createdAt: string;
}

export interface BuyerOrgUpcomingBooking {
  id: string;
  userName: string;
  listingName: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface BuyerOrgActivityEntry {
  id: string;
  userName: string;
  actionType: string;
  description: string;
  listingName: string | null;
  trainingSessionTitle: string | null;
  createdAt: string;
}

export type BuyerOrgTransactionScope = "all" | "personal" | "others";

export interface BuyerOrgTransaction {
  id: string;
  userId: string;
  userName: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

export interface BuyerOrgStats {
  memberCount: number;
  totalBookings: number;
  upcomingBookingsCount: number;
  upcomingBookings: BuyerOrgUpcomingBooking[];
}

export interface BuyerOrgActivityPageResult {
  activity: BuyerOrgActivityEntry[];
  meta: { page: number; pageSize: number; total: number };
}

export interface BuyerOrgTransactionsPageResult {
  transactions: BuyerOrgTransaction[];
  meta: { page: number; pageSize: number; total: number };
}

export function useBuyerOrganization() {
  return useQuery({
    queryKey: ["buyer-organization"],
    queryFn: () =>
      apiFetch<{
        organization: BuyerOrganization | null;
        pendingRequest?: { organizationName: string } | null;
      }>("/api/buyer-organization"),
  });
}

function useInvalidateBuyerOrganization() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["buyer-organization"] });
    queryClient.invalidateQueries({ queryKey: ["buyer-organization-members"] });
    queryClient.invalidateQueries({ queryKey: ["buyer-organization-join-requests"] });
    queryClient.invalidateQueries({ queryKey: ["buyer-organization-stats"] });
    queryClient.invalidateQueries({ queryKey: ["buyer-organization-activity"] });
    queryClient.invalidateQueries({ queryKey: ["buyer-organization-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["buyer-organization-spend-requests"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };
}

export function useJoinBuyerOrganization() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ status: "joined" | "pending"; organization: { id: string; name: string } }>(
        "/api/buyer-organization/join",
        { method: "POST", body: JSON.stringify({ name }) }
      ),
    onSuccess: invalidate,
  });
}

export function useBuyerOrgMembers() {
  return useQuery({
    queryKey: ["buyer-organization-members"],
    queryFn: () => apiFetch<{ members: BuyerOrgMember[] }>("/api/buyer-organization/members"),
    select: (data) => data.members,
  });
}

export function useRemoveBuyerOrgMember() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/buyer-organization/members/${userId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function usePromoteBuyerOrgMember() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/buyer-organization/members/${userId}/promote`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useBuyerOrgJoinRequests() {
  return useQuery({
    queryKey: ["buyer-organization-join-requests"],
    queryFn: () => apiFetch<{ requests: BuyerOrgJoinRequest[] }>("/api/buyer-organization/join-requests"),
    select: (data) => data.requests,
  });
}

export function useResolveBuyerOrgJoinRequest() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: "approved" | "rejected"; reason?: string }) =>
      apiFetch(`/api/buyer-organization/join-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: invalidate,
  });
}

export function useBuyerOrgStats(enabled: boolean) {
  return useQuery({
    queryKey: ["buyer-organization-stats"],
    queryFn: () => apiFetch<BuyerOrgStats>("/api/buyer-organization/stats"),
    enabled,
  });
}

export function useBuyerOrgActivity(
  enabled: boolean,
  dateRange: { from: string | null; to: string | null },
  page: number
) {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  params.set("page", String(page));

  return useQuery({
    queryKey: ["buyer-organization-activity", dateRange, page],
    queryFn: () => apiFetch<BuyerOrgActivityPageResult>(`/api/buyer-organization/activity?${params.toString()}`),
    enabled,
    placeholderData: (previousData) => previousData,
  });
}

export function useBuyerOrgTransactions(
  enabled: boolean,
  dateRange: { from: string | null; to: string | null },
  page: number,
  scope: BuyerOrgTransactionScope = "all"
) {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  params.set("page", String(page));
  params.set("scope", scope);

  return useQuery({
    queryKey: ["buyer-organization-transactions", dateRange, page, scope],
    queryFn: () =>
      apiFetch<BuyerOrgTransactionsPageResult>(`/api/buyer-organization/transactions?${params.toString()}`),
    enabled,
    placeholderData: (previousData) => previousData,
  });
}

export function useRequestBuyerOrgPromotion() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: () => apiFetch<{ promotionRequested: boolean }>("/api/buyer-organization/promotion-request", {
      method: "POST",
    }),
    onSuccess: invalidate,
  });
}

// 2026-07-28 "Buyer Org pool — delegated spend" additions below.

export function useTopUpBuyerOrgPool() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: ({ amount, paymentMethodId }: { amount: number; paymentMethodId: string }) =>
      apiFetch("/api/buyer-organization/topup", { method: "POST", body: JSON.stringify({ amount, paymentMethodId }) }),
    onSuccess: invalidate,
  });
}

export function useSetMemberPermissions() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: ({ userId, canBook, canPurchase }: { userId: string; canBook?: boolean; canPurchase?: boolean }) =>
      apiFetch(`/api/buyer-organization/members/${userId}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ canBook, canPurchase }),
      }),
    onSuccess: invalidate,
  });
}

export function useBuyerOrgSpendRequests(enabled: boolean, status?: string) {
  const params = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["buyer-organization-spend-requests", status],
    queryFn: () =>
      apiFetch<{ requests: BuyerOrgSpendRequest[] }>(`/api/buyer-organization/spend-requests${params}`),
    select: (data) => data.requests,
    enabled,
  });
}

export interface CreateSpendRequestBookingInput {
  type: "booking";
  listingId: string;
  bookingType: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
}

export interface CreateSpendRequestPurchaseInput {
  type: "consumable_purchase";
  listingId: string;
  quantity: number;
}

export function useCreateBuyerOrgSpendRequest() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: (input: CreateSpendRequestBookingInput | CreateSpendRequestPurchaseInput) =>
      apiFetch<{ request: BuyerOrgSpendRequest }>("/api/buyer-organization/spend-requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useFulfillBuyerOrgSpendRequest() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/buyer-organization/spend-requests/${id}/fulfill`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useDeclineBuyerOrgSpendRequest() {
  const invalidate = useInvalidateBuyerOrganization();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/api/buyer-organization/spend-requests/${id}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: invalidate,
  });
}

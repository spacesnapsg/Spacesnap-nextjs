import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface BuyerOrganization {
  id: string;
  name: string;
  isAdmin: boolean;
  adminName: string | null;
  promotionRequested: boolean;
}

export interface BuyerOrgMember {
  id: string;
  name: string;
  email: string;
  isBuyerOrgAdmin: boolean;
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

export interface BuyerOrgTransaction {
  id: string;
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
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      apiFetch(`/api/buyer-organization/join-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
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
  page: number
) {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  params.set("page", String(page));

  return useQuery({
    queryKey: ["buyer-organization-transactions", dateRange, page],
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

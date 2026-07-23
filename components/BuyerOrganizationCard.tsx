"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import OrgSearchInput from "@/components/OrgSearchInput";
import ManageBuyerOrganizationModal from "@/components/ManageBuyerOrganizationModal";
import { ApiRequestError } from "@/lib/api-client";
import {
  useBuyerOrganization,
  useJoinBuyerOrganization,
  useRequestBuyerOrgPromotion,
} from "@/lib/hooks/useBuyerOrganization";

// Sprint 6.10 "User-Side Buyer Organization" (2026-07-23) — the shared
// purchased-credit pool org itself isn't spendable yet (schema-only
// groundwork, Transaction.buyerOrganizationId), but membership — join, seat,
// or queue for approval — is real. Originally placed on the Financials page
// per the plan's own placement note, relocated the same day to the Digital
// Passport page's profile card — the product owner's call, replacing that
// card's pre-existing "Company" field, which displayed the (unrelated)
// supplier Company name and had no working save path at all (a second,
// separate dead-UI bug, unrelated to this feature).
export default function BuyerOrganizationCard() {
  const { data, isLoading } = useBuyerOrganization();
  const joinOrg = useJoinBuyerOrganization();
  const requestPromotion = useRequestBuyerOrgPromotion();
  const [manageOpen, setManageOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: "joined" | "pending"; name: string } | null>(null);

  if (isLoading) return null;

  function handleJoin() {
    setError(null);
    setResult(null);
    joinOrg.mutate(name, {
      onSuccess: (data) => {
        setResult({ status: data.status, name: data.organization.name });
        setName("");
      },
      onError: (err) => setError(err instanceof ApiRequestError ? err.message : "Something went wrong."),
    });
  }

  if (!data?.organization) {
    return (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-body-text mb-2">
          <Building2 size={18} className="text-user-teal-end" />
          Organization
        </h2>

        {data?.pendingRequest ? (
          <p className="text-sm text-muted-text">
            Your request to join <span className="text-body-text font-medium">{data.pendingRequest.organizationName}</span>{" "}
            is pending approval from their organization admin.
          </p>
        ) : result ? (
          <p className="text-sm text-body-text">
            {result.status === "joined"
              ? `You're in — ${result.name}.`
              : `Your request to join ${result.name} is pending approval from their organization admin.`}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-text mb-3">
              Join or create an organization to share a purchased-credit pool with your team.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <OrgSearchInput
                value={name}
                onChange={setName}
                searchUrl="/api/buyer-organizations/search"
                resultsKey="organizations"
                placeholder="Search for organization or create new"
                className="flex-1"
              />
              <Button
                disabled={!name.trim() || joinOrg.isPending}
                onClick={handleJoin}
                className="h-11 px-5 shrink-0"
              >
                {joinOrg.isPending ? "Joining…" : "Join / Create"}
              </Button>
            </div>
            {error && <p className="text-sm text-error-red mt-2">{error}</p>}
          </>
        )}
      </Card>
    );
  }

  const { organization } = data;

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-body-text">
            <Building2 size={18} className="text-user-teal-end" />
            {organization.name}
          </h2>
          <p className="text-sm text-muted-text mt-1">{organization.isAdmin ? "Organization Admin" : "Member"}</p>
        </div>
        {organization.isAdmin && (
          <Button variant="ghost" onClick={() => setManageOpen(true)} className="h-9 px-4 text-sm">
            Manage Organization
          </Button>
        )}
      </div>

      {!organization.isAdmin && (
        <div className="mt-4 pt-4 border-t border-border/40">
          {organization.adminName ? (
            <p className="text-sm text-muted-text">
              Ask your organization admin,{" "}
              <span className="text-body-text font-medium">{organization.adminName}</span>, for admin access.
            </p>
          ) : (
            <>
              <Button
                variant="ghost"
                disabled={organization.promotionRequested || requestPromotion.isPending}
                onClick={() => {
                  setError(null);
                  requestPromotion.mutate();
                }}
                className="h-9 px-4 text-sm"
              >
                {organization.promotionRequested ? "Request Pending" : "Request Organization Admin Access"}
              </Button>
              {requestPromotion.isError && (
                <p className="text-xs text-error-red mt-2">
                  {requestPromotion.error instanceof ApiRequestError
                    ? requestPromotion.error.message
                    : "Something went wrong."}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <ManageBuyerOrganizationModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </Card>
  );
}

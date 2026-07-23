"use client";

import { useState } from "react";
import { UserMinus, ShieldCheck, Check, X as XIcon } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { ApiRequestError } from "@/lib/api-client";
import {
  useBuyerOrgMembers,
  useRemoveBuyerOrgMember,
  usePromoteBuyerOrgMember,
  useBuyerOrgJoinRequests,
  useResolveBuyerOrgJoinRequest,
} from "@/lib/hooks/useBuyerOrganization";

type Tab = "members" | "requests";

interface ManageBuyerOrganizationModalProps {
  open: boolean;
  onClose: () => void;
}

// Org-admin membership management — mirrors the shape of the admin
// concierge-review modals (app/(admin)/admin/dashboard/page.tsx) but scoped
// to a single organization's own admin rather than a system admin.
export default function ManageBuyerOrganizationModal({ open, onClose }: ManageBuyerOrganizationModalProps) {
  const [tab, setTab] = useState<Tab>("members");
  const [error, setError] = useState<string | null>(null);

  const { data: members } = useBuyerOrgMembers();
  const removeMember = useRemoveBuyerOrgMember();
  const promoteMember = usePromoteBuyerOrgMember();
  const { data: requests } = useBuyerOrgJoinRequests();
  const resolveRequest = useResolveBuyerOrgJoinRequest();

  function handleError(err: unknown) {
    setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
  }

  return (
    <Modal open={open} onClose={onClose} className="w-full max-w-[560px]">
      <h2 className="text-xl font-semibold text-body-text mb-4">Manage Organization</h2>

      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("members")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "members" ? "border-user-teal-end text-body-text" : "border-transparent text-muted-text"
          }`}
        >
          Members
        </button>
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "requests" ? "border-user-teal-end text-body-text" : "border-transparent text-muted-text"
          }`}
        >
          Join Requests
          {requests && requests.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-user-teal-end text-white text-[10px] font-semibold">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {error && <p className="text-sm text-error-red mb-4">{error}</p>}

      {tab === "members" && (
        <div className="flex flex-col gap-3">
          {!members || members.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-8">No members yet.</p>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between border border-border rounded p-3">
                <div>
                  <p className="text-sm font-medium text-body-text">
                    {member.name}
                    {member.isBuyerOrgAdmin && (
                      <span className="ml-2 text-xs text-user-teal-end font-semibold">Admin</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-text">{member.email}</p>
                </div>
                {!member.isBuyerOrgAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Promote to admin"
                      disabled={promoteMember.isPending}
                      onClick={() => {
                        setError(null);
                        promoteMember.mutate(member.id, { onError: handleError });
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-user-teal-end transition-colors"
                    >
                      <ShieldCheck size={16} />
                    </button>
                    <button
                      type="button"
                      title="Remove member"
                      disabled={removeMember.isPending}
                      onClick={() => {
                        setError(null);
                        removeMember.mutate(member.id, { onError: handleError });
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-error-red transition-colors"
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="flex flex-col gap-3">
          {!requests || requests.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-8">No pending join requests.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="flex items-center justify-between border border-border rounded p-3">
                <div>
                  <p className="text-sm font-medium text-body-text">{request.requestedBy.name}</p>
                  <p className="text-xs text-muted-text">{request.requestedBy.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={resolveRequest.isPending}
                    onClick={() => {
                      setError(null);
                      resolveRequest.mutate(
                        { id: request.id, status: "approved" },
                        { onError: handleError }
                      );
                    }}
                    className="h-8 px-3 text-xs gap-1"
                  >
                    <Check size={14} /> Approve
                  </Button>
                  <button
                    type="button"
                    disabled={resolveRequest.isPending}
                    onClick={() => {
                      setError(null);
                      resolveRequest.mutate(
                        { id: request.id, status: "rejected" },
                        { onError: handleError }
                      );
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded text-muted-text hover:text-error-red transition-colors"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}

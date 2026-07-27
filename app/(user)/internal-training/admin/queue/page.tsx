"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import Card from "@/components/Card";
import { useOrgInternalTrainingEvents } from "@/lib/hooks/useInternalTrainingEvents";
import { useBuyerOrgMembers } from "@/lib/hooks/useBuyerOrganization";
import { buildSignoffQueue } from "@/lib/internal-training-ui";

// Cross-event sign-off queue: no dedicated backend route exists for this —
// listOrgEvents already embeds every participant per event, so this page
// reuses the same cache entry as the CA dashboard and derives the queue
// client-side via buildSignoffQueue. Navigation only (links through to the
// event page for the actual pass/fail decision) so the disabled-reason
// logic isn't duplicated across two surfaces.
export default function InternalTrainingSignoffQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: events, isLoading } = useOrgInternalTrainingEvents();
  const { data: members } = useBuyerOrgMembers();

  useEffect(() => {
    if (status === "authenticated" && !session?.user.isBuyerOrgAdmin) router.replace("/passport");
  }, [status, session, router]);

  if (status !== "authenticated" || !session?.user.isBuyerOrgAdmin) return null;

  const queue = buildSignoffQueue(events ?? []);

  function memberName(userId: string) {
    return members?.find((m) => m.id === userId)?.name ?? userId;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-body-text mb-6">
        <ListChecks size={22} className="text-ca-emerald-end" />
        Sign-off Queue
      </h1>

      {isLoading ? (
        <p className="text-sm text-muted-text">Loading…</p>
      ) : queue.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-text">No participants are currently awaiting a sign-off decision.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {queue.map((row) => (
            <Link key={row.participantId} href={`/internal-training/admin/${row.eventId}`}>
              <Card className="hover:border-ca-emerald-start/40 transition-colors flex items-center justify-between">
                <div>
                  <p className="font-medium text-body-text">{memberName(row.userId)}</p>
                  <p className="text-sm text-muted-text mt-0.5">{row.eventTitle}</p>
                </div>
                <span className="text-xs text-ca-emerald-end font-medium">Review →</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

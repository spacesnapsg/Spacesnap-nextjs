"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ShieldCheck, Plus, ListChecks } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import CreateInternalTrainingEventModal from "@/components/CreateInternalTrainingEventModal";
import { useOrgInternalTrainingEvents } from "@/lib/hooks/useInternalTrainingEvents";
import { buildSignoffQueue } from "@/lib/internal-training-ui";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// CA-only dashboard. Not a new portal/navbar — lives inside the existing
// (user) route group (already wrapped in <RoleGuard guard="user"> at
// app/(user)/layout.tsx), gated here by an inline isBuyerOrgAdmin check,
// same effect shape RoleGuard itself uses.
export default function InternalTrainingAdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: events, isLoading } = useOrgInternalTrainingEvents();

  useEffect(() => {
    if (status === "authenticated" && !session?.user.isBuyerOrgAdmin) router.replace("/passport");
  }, [status, session, router]);

  if (status !== "authenticated" || !session?.user.isBuyerOrgAdmin) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-body-text">
          <ShieldCheck size={22} className="text-ca-emerald-end" />
          Internal Training
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/internal-training/admin/queue"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded font-medium border border-ca-emerald-start/40 text-ca-emerald-end hover:bg-ca-emerald-start/10 transition-colors"
          >
            <ListChecks size={16} />
            Sign-off Queue
          </Link>
          <Button
            onClick={() => setCreateOpen(true)}
            className="!bg-gradient-to-r !from-ca-emerald-start !to-ca-emerald-end gap-1.5"
          >
            <Plus size={16} />
            Create Training Event
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-text">Loading…</p>
      ) : !events || events.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-text">No internal training events yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => {
            const participantCount = event.participants?.length ?? 0;
            const awaitingCount = buildSignoffQueue([event]).length;
            return (
              <Link key={event.id} href={`/internal-training/admin/${event.id}`}>
                <Card className="hover:border-ca-emerald-start/40 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-body-text">{event.title}</h2>
                      <p className="text-sm text-muted-text mt-0.5">
                        {event.certificateName ?? "Certificate"} · {formatDate(event.trainingDate)} ·{" "}
                        {participantCount} participant{participantCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    {awaitingCount > 0 && (
                      <span className="shrink-0 rounded-full border bg-amber/15 text-amber border-amber/30 px-2.5 py-1 text-xs font-medium">
                        {awaitingCount} awaiting sign-off
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <CreateInternalTrainingEventModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

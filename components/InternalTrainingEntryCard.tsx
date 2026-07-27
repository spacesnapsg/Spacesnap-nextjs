"use client";

import Link from "next/link";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import Card from "@/components/Card";

// Entry point into the internal training sign-off flow, rendered on the
// Digital Passport page right after BuyerOrganizationCard. Any member sees
// the participant-side "My Trainings" link (GET /api/internal-training-events
// is scoped to any authenticated user); only a CA (isBuyerOrgAdmin) sees the
// second, emerald-accented "Manage Internal Training" link into the
// CA-only dashboard.
export default function InternalTrainingEntryCard() {
  const { data: session } = useSession();

  return (
    <Card className="mb-6">
      <h2 className="text-lg font-semibold text-body-text mb-3">Internal Training</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href="/internal-training"
          className="inline-flex items-center gap-2 h-11 px-5 rounded font-medium border border-user-teal-end/40 text-user-teal-end hover:bg-user-teal-end/10 transition-colors"
        >
          <GraduationCap size={16} />
          My Internal Trainings
        </Link>
        {session?.user.isBuyerOrgAdmin && (
          <Link
            href="/internal-training/admin"
            className="inline-flex items-center gap-2 h-11 px-5 rounded font-medium bg-gradient-to-r from-ca-emerald-start to-ca-emerald-end text-white"
          >
            <ShieldCheck size={16} />
            Manage Internal Training
          </Link>
        )}
      </div>
    </Card>
  );
}

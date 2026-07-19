import Card from "@/components/Card";

export default function AdminFinancialsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-admin-red-start to-admin-orange-end bg-clip-text text-transparent">
          Platform Financials
        </h1>
        <p className="text-muted-text mt-1">Revenue and transaction activity across all operators</p>
      </div>

      <Card>
        <p className="text-sm text-muted-text">
          Not wired yet — there&apos;s no admin-wide endpoint for platform revenue, revenue-by-operator,
          or a cross-company transaction feed. The <code>transactions</code> table is keyed by user, not
          by company, so this page needs its own aggregation route rather than a small join. Tracked as a
          backend gap.
        </p>
      </Card>
    </div>
  );
}

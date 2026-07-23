import { prisma } from "@/lib/prisma";
import { sgdToCredits } from "@/lib/credit-units";
import type { ActivityQuery } from "@/lib/activity";

// Paginated (10/page default), date-range-filterable transaction feed for
// the caller's own wallet — split out of GET /api/wallet (2026-07-23), same
// "Recent Activity" pagination/date-picker treatment applied everywhere
// else in this codebase. Deliberately separate from GET /api/wallet's own
// `transactions` field (unchanged, still a flat take-50 list) — that field
// feeds the Financials page's derived stats (This Month's Spend, Avg
// Monthly Spend, Balance Trend sparkline), which need a broader window than
// whatever the Recent Transactions display page currently shows; paging
// that list down to 10 would have silently made those stats wrong. Reuses
// ActivityQuery/parseActivityQuery from lib/activity.ts (its `types` field
// is simply unused here) for the same query contract as every other
// paginated audit-trail feed.
export async function getWalletTransactionsPage(userId: string, query: ActivityQuery) {
  const where = {
    userId,
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        booking: { include: { listing: { select: { name: true } } } },
        bulkOrderRequest: { include: { listing: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export function serializeWalletTransaction(t: Awaited<ReturnType<typeof getWalletTransactionsPage>>["items"][number]) {
  return {
    id: t.id.toString(),
    type: t.type,
    amount: sgdToCredits(Number(t.amount)),
    description: t.description ?? t.booking?.listing.name ?? t.bulkOrderRequest?.listing.name ?? t.type,
    createdAt: t.createdAt.toISOString(),
  };
}

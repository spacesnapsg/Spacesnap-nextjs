import { ActivityActionType, type ActivityLog, type Listing, type TrainingSession } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiValidationError } from "@/lib/api-errors";

const ACTION_TYPE_VALUES = new Set<string>(Object.values(ActivityActionType));

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export interface ActivityQuery {
  types: ActivityActionType[] | null;
  from: Date | null;
  to: Date | null;
  page: number;
  pageSize: number;
}

// Pagination (page/pageSize, default 10/page) replaced the old flat
// limit-capped-at-200 feed 2026-07-23 — an unbounded "recent activity" list
// only ever grows, and the dashboard had no way to page back through
// history. `from`/`to` (explicit ISO dates) replaced the old `days` preset
// param at the same time, backing a real date-range picker instead of only
// 7/30/90-day/all-time buttons — the frontend's preset buttons now just set
// from/to under the hood instead of being a server-side concept.
export function parseActivityQuery(searchParams: URLSearchParams): ActivityQuery {
  const errors: Record<string, string[]> = {};

  let types: ActivityActionType[] | null = null;
  const rawTypes = searchParams.get("types");
  if (rawTypes) {
    const requested = rawTypes.split(",").map((t) => t.trim()).filter(Boolean);
    const invalid = requested.filter((t) => !ACTION_TYPE_VALUES.has(t));
    if (invalid.length > 0) {
      errors.types = [`Unknown activity type(s): ${invalid.join(", ")}.`];
    } else {
      types = requested as ActivityActionType[];
    }
  }

  let from: Date | null = null;
  const rawFrom = searchParams.get("from");
  if (rawFrom) {
    const parsed = new Date(rawFrom);
    if (Number.isNaN(parsed.getTime())) {
      errors.from = ["from must be a valid date."];
    } else {
      from = parsed;
    }
  }

  let to: Date | null = null;
  const rawTo = searchParams.get("to");
  if (rawTo) {
    const parsed = new Date(rawTo);
    if (Number.isNaN(parsed.getTime())) {
      errors.to = ["to must be a valid date."];
    } else {
      // A bare "to" date (no time component) means "through the end of that
      // day" — matches how a date-range picker's end date reads to a user.
      parsed.setHours(23, 59, 59, 999);
      to = parsed;
    }
  }

  if (from && to && from > to) {
    errors.from = [...(errors.from ?? []), "from must not be after to."];
  }

  let page = 1;
  const rawPage = searchParams.get("page");
  if (rawPage) {
    const parsed = Number(rawPage);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.page = ["page must be a positive integer."];
    } else {
      page = parsed;
    }
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  const rawPageSize = searchParams.get("pageSize");
  if (rawPageSize) {
    const parsed = Number(rawPageSize);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.pageSize = ["pageSize must be a positive integer."];
    } else {
      pageSize = Math.min(parsed, MAX_PAGE_SIZE);
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiValidationError(errors);
  }

  return { types, from, to, page, pageSize };
}

type ActivityLogWithRelations = ActivityLog & {
  listing: Pick<Listing, "name"> | null;
  trainingSession: Pick<TrainingSession, "title"> | null;
};

export interface ActivityPage {
  items: ActivityLogWithRelations[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getUserActivity(userId: string, query: ActivityQuery): Promise<ActivityPage> {
  const where = {
    userId,
    ...(query.types ? { actionType: { in: query.types } } : {}),
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
    prisma.activityLog.findMany({
      where,
      include: {
        listing: { select: { name: true } },
        trainingSession: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export function serializeActivityLogEntry(entry: ActivityLogWithRelations) {
  return {
    id: entry.id.toString(),
    actionType: entry.actionType,
    description: entry.description,
    relatedListingId: entry.relatedListingId?.toString() ?? null,
    listingName: entry.listing?.name ?? null,
    relatedTrainingSessionId: entry.relatedTrainingSessionId?.toString() ?? null,
    trainingSessionTitle: entry.trainingSession?.title ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

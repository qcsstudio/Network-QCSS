export const contentPostStatuses = ["draft", "approved", "published", "archived", "deleted"] as const;
export type ContentPostStatus = (typeof contentPostStatuses)[number];

export const contentPostSorts = ["updated-desc", "updated-asc", "published-desc", "title-asc"] as const;
export type ContentPostSort = (typeof contentPostSorts)[number];

export type ContentPostListQuery = {
  format: "all" | "blog" | "resource";
  page: number;
  pageSize: number;
  query: string;
  sort: ContentPostSort;
  status: "all" | ContentPostStatus;
};

export type ContentPostWorkflowAction = "approve" | "archive" | "delete" | "draft" | "publish" | "regenerate" | "restore" | "save";

const transitionSources: Record<ContentPostWorkflowAction, ContentPostStatus[]> = {
  approve: ["draft"],
  archive: ["draft", "approved", "published"],
  delete: ["draft", "approved", "published", "archived"],
  draft: ["approved", "published", "archived"],
  publish: ["approved"],
  regenerate: ["draft"],
  restore: ["archived", "deleted"],
  save: ["draft"]
};

function compact(value: unknown, max = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function enumValue<T extends readonly string[]>(value: unknown, values: T, fallback: T[number]) {
  const normalized = compact(value).toLowerCase();
  return values.includes(normalized as T[number]) ? (normalized as T[number]) : fallback;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

export function normalizeContentPostListQuery(input: Record<string, unknown> = {}): ContentPostListQuery {
  return {
    format: enumValue(input.format, ["all", "blog", "resource"] as const, "all"),
    page: boundedInteger(input.page, 1, 1, 100_000),
    pageSize: boundedInteger(input.pageSize, 12, 6, 50),
    query: compact(input.q ?? input.query, 180),
    sort: enumValue(input.sort, contentPostSorts, "updated-desc"),
    status: enumValue(input.status, ["all", ...contentPostStatuses] as const, "all")
  };
}

export function canRunContentPostAction(status: ContentPostStatus, action: ContentPostWorkflowAction) {
  return transitionSources[action].includes(status);
}

export function assertContentPostAction(status: ContentPostStatus, action: ContentPostWorkflowAction) {
  if (canRunContentPostAction(status, action)) return;
  const allowed = transitionSources[action].join(", ");
  throw new Error(`Cannot ${action} content in ${status} status. Allowed status: ${allowed}.`);
}

export function emptyContentPostStatusCounts() {
  return Object.fromEntries(contentPostStatuses.map((status) => [status, 0])) as Record<ContentPostStatus, number>;
}

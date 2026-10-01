import { getPrismaClient } from "./prisma.ts";

const reservationAction = "editorial.image_budget_reserved";

export function imageBudgetLimit(value: string | undefined, fallback: number) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

// A short database lock serializes reservations, not the external AI request.
export async function reserveEditorialImageBudget(assetId: string) {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return getPrismaClient().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71642931)`;
    const reservations = await tx.auditLog.findMany({
      where: { action: reservationAction, createdAt: { gte: month } },
      select: { target: true, createdAt: true }
    });
    const reservedIds = reservations.flatMap((item) => item.target ? [item.target] : []);
    const legacy = await tx.editorialImage.findMany({
      where: { id: { notIn: reservedIds }, provider: { in: ["black-forest-labs", "openai-direct"] }, updatedAt: { gte: month } },
      select: { updatedAt: true }
    });
    const monthly = reservations.length + legacy.length;
    const daily = reservations.filter((item) => item.createdAt >= day).length + legacy.filter((item) => item.updatedAt >= day).length;
    if (daily >= imageBudgetLimit(process.env.EDITORIAL_PAID_IMAGES_DAILY_LIMIT, 2) ||
        monthly >= imageBudgetLimit(process.env.EDITORIAL_PAID_IMAGES_MONTHLY_LIMIT, 12)) return false;
    await tx.auditLog.create({ data: { action: reservationAction, actor: "image-worker", target: assetId, metadata: { dailyBefore: daily, monthlyBefore: monthly } } });
    return true;
  }, { timeout: 15_000 });
}

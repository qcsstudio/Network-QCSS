import type { Prisma } from "@prisma/client";
import { buildCustodyEventHash } from "@/lib/verifygrid-assurance-domain";

type CustodyEventInput = {
  workspaceId: string;
  engagementId: string;
  evidenceId?: string | null;
  eventType: string;
  subjectType: string;
  subjectId: string;
  action: string;
  actor: string;
  sourceSha256?: string | null;
  classification?: string;
  custodyLocation?: string | null;
  retentionDays?: number;
  details?: Record<string, unknown>;
  occurredAt?: Date;
};

export async function appendVerifyGridCustodyEvent(tx: Prisma.TransactionClient, input: CustodyEventInput) {
  const previous = await tx.verifyGridCustodyEvent.findFirst({
    where: { engagementId: input.engagementId },
    orderBy: { sequence: "desc" },
    select: { sequence: true, eventHash: true }
  });
  const sequence = (previous?.sequence || 0) + 1;
  const occurredAt = input.occurredAt || new Date();
  const classification = input.classification || "confidential";
  const details = input.details || {};
  const eventHash = buildCustodyEventHash({
    engagementId: input.engagementId,
    sequence,
    eventType: input.eventType,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    action: input.action,
    actor: input.actor,
    sourceSha256: input.sourceSha256,
    previousHash: previous?.eventHash,
    occurredAt: occurredAt.toISOString(),
    classification,
    details
  });
  const retentionDays = Math.max(30, Math.min(input.retentionDays || 365, 3650));
  return tx.verifyGridCustodyEvent.create({
    data: {
      workspaceId: input.workspaceId,
      engagementId: input.engagementId,
      evidenceId: input.evidenceId || null,
      sequence,
      eventType: input.eventType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      action: input.action,
      actor: input.actor,
      sourceSha256: input.sourceSha256 || null,
      previousHash: previous?.eventHash || null,
      eventHash,
      classification,
      custodyLocation: input.custodyLocation || null,
      retentionUntil: new Date(occurredAt.getTime() + retentionDays * 24 * 60 * 60_000),
      details: details as Prisma.InputJsonValue,
      occurredAt
    }
  });
}

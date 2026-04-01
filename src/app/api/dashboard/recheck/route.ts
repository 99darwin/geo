import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireClientOwner } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { runMonthlyCheck } from "@/lib/pipelines/monthly-check";
import type { ApiResponse } from "@/types";

// TODO: Gate behind plan tier or remove when out of testing phase
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes per client

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  clientId: z.string().regex(UUID_RE, "Invalid clientId"),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ triggered: boolean }>>> {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "clientId is required" },
      { status: 400 }
    );
  }

  const { clientId } = parsed.data;

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  const isAdmin = auth.session.user.role === "admin";

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { onboardingStatus: true, plan: true, lastRecheckAt: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (
    !["starter", "growth"].includes(client.plan ?? "") ||
    !["setup_complete", "active"].includes(client.onboardingStatus)
  ) {
    return NextResponse.json(
      { error: "Client not eligible for recheck" },
      { status: 400 }
    );
  }

  if (isAdmin) {
    // Admin: no cooldown — update timestamp for bookkeeping only
    await prisma.client.update({
      where: { id: clientId },
      data: { lastRecheckAt: new Date() },
    });
  } else {
    // Regular user: enforce cooldown
    const cooldownThreshold = new Date(Date.now() - COOLDOWN_MS);
    const updated = await prisma.client.updateMany({
      where: {
        id: clientId,
        OR: [
          { lastRecheckAt: null },
          { lastRecheckAt: { lt: cooldownThreshold } },
        ],
      },
      data: { lastRecheckAt: new Date() },
    });

    if (updated.count === 0) {
      const waitSec = client.lastRecheckAt
        ? Math.max(
            0,
            Math.ceil(
              (COOLDOWN_MS - (Date.now() - client.lastRecheckAt.getTime())) / 1000
            )
          )
        : 0;
      const message = waitSec > 0
        ? `Please wait ${waitSec}s before triggering again.`
        : "Report already queued. Please wait a few minutes.";
      return NextResponse.json(
        { error: message },
        { status: 429 }
      );
    }
  }

  // Run in background — don't block the response
  const promise = runMonthlyCheck(clientId, { force: true }).catch((err) => {
    console.error(`[Dashboard Recheck] Failed for ${clientId}:`, err);
  });

  try {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(promise);
  } catch {
    // waitUntil not available (local dev) — fire and forget
  }

  return NextResponse.json({ data: { triggered: true } });
}

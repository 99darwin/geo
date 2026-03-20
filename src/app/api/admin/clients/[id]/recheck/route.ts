import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { runMonthlyCheck } from "@/lib/pipelines/monthly-check";
import type { ApiResponse } from "@/types";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per client

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ triggered: boolean }>>> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    select: { onboardingStatus: true, plan: true, lastRecheckAt: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (
    !["starter", "growth"].includes(client.plan ?? "") ||
    !["setup_complete", "active"].includes(client.onboardingStatus)
  ) {
    return NextResponse.json({ error: "Client not eligible for recheck" }, { status: 400 });
  }

  // Atomic cooldown: only update if expired or never set
  const cooldownThreshold = new Date(Date.now() - COOLDOWN_MS);
  const updated = await prisma.client.updateMany({
    where: {
      id,
      OR: [
        { lastRecheckAt: null },
        { lastRecheckAt: { lt: cooldownThreshold } },
      ],
    },
    data: { lastRecheckAt: new Date() },
  });

  if (updated.count === 0) {
    const waitSec = client.lastRecheckAt
      ? Math.ceil((COOLDOWN_MS - (Date.now() - client.lastRecheckAt.getTime())) / 1000)
      : 0;
    return NextResponse.json(
      { error: `Please wait ${waitSec}s before triggering again.` },
      { status: 429 }
    );
  }

  // Run in background — don't block the response
  const promise = runMonthlyCheck(id).catch((err) => {
    console.error(`[Admin Recheck] Failed for ${id}:`, err);
  });

  try {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(promise);
  } catch {
    // waitUntil not available (local dev) — fire and forget
  }

  return NextResponse.json({ data: { triggered: true } });
}

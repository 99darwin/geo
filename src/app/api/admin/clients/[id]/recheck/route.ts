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

  if (client.lastRecheckAt && Date.now() - client.lastRecheckAt.getTime() < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - client.lastRecheckAt.getTime())) / 1000);
    return NextResponse.json(
      { error: `Please wait ${waitSec}s before triggering again.` },
      { status: 429 }
    );
  }

  await prisma.client.update({ where: { id }, data: { lastRecheckAt: new Date() } });

  // Run in background — don't block the response
  // Note: Using waitUntil if available, otherwise fire-and-forget
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

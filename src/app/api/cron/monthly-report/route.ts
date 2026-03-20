import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { runMonthlyReport } from "@/lib/pipelines/monthly-report";
import type { ApiResponse } from "@/types";

const BATCH_SIZE = 100;

function verifyCronSecret(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

async function handleMonthlyReport(
  request: NextRequest
): Promise<
  NextResponse<
    ApiResponse<{
      sent: number;
      failed: number;
    }>
  >
> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/monthly-report] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!verifyCronSecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cursor =
      request.nextUrl.searchParams.get("cursor") ??
      (request.method === "POST"
        ? await request.json().then((b) => b.cursor).catch(() => null)
        : null);

    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1);

    const clientsWithScores = await prisma.visibilityScore.findMany({
      where: {
        period,
        ...(cursor ? { clientId: { gt: cursor } } : {}),
      },
      select: { clientId: true },
      orderBy: { clientId: "asc" },
      take: BATCH_SIZE,
    });

    const clientIds = [...new Set(clientsWithScores.map((s) => s.clientId))];

    let sent = 0;
    let failed = 0;

    for (const clientId of clientIds) {
      try {
        await runMonthlyReport(clientId);
        sent++;
      } catch (error) {
        console.error(`[Monthly Report] Failed for client ${clientId}:`, error);
        failed++;
      }
    }

    // Self-trigger next batch if we hit the limit
    const nextCursor =
      clientIds.length === BATCH_SIZE
        ? clientIds[clientIds.length - 1]
        : undefined;

    if (nextCursor) {
      console.log(
        `[cron/monthly-report] Batch limit reached, triggering next page from cursor ${nextCursor}`
      );
      const cronSecret = process.env.CRON_SECRET!;
      try {
        const { waitUntil } = await import("@vercel/functions");
        const selfUrl = new URL(request.url);
        selfUrl.searchParams.set("cursor", nextCursor);
        waitUntil(
          fetch(selfUrl.toString(), {
            method: "GET",
            headers: { authorization: `Bearer ${cronSecret}` },
          }).catch((err) =>
            console.error("[cron/monthly-report] Self-trigger failed:", err)
          )
        );
      } catch {
        console.warn(
          "[cron/monthly-report] waitUntil unavailable; remaining clients will be processed next cron run"
        );
      }
    }

    return NextResponse.json({
      data: { sent, failed },
    });
  } catch (error) {
    console.error("[cron/monthly-report]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Vercel cron sends GET requests
export const GET = handleMonthlyReport;
export const POST = handleMonthlyReport;

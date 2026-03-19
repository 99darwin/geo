import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { runMonthlyReport } from "@/lib/pipelines/monthly-report";
import type { ApiResponse } from "@/types";

const BATCH_SIZE = 10;

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
      nextCursor: string | null;
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
    const body = await request.json().catch(() => ({}));
    const cursor: string | null = body.cursor || null;

    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1);

    const clientsWithScores = await prisma.visibilityScore.findMany({
      where: { period },
      select: { clientId: true },
      orderBy: { clientId: "asc" },
      take: BATCH_SIZE,
      ...(cursor
        ? {
            cursor: {
              clientId_period: { clientId: cursor, period },
            },
            skip: 1,
          }
        : {}),
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

    const nextCursor =
      clientsWithScores.length === BATCH_SIZE
        ? clientsWithScores[clientsWithScores.length - 1].clientId
        : null;

    return NextResponse.json({
      data: { sent, failed, nextCursor },
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

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { runMonthlyCheck } from "@/lib/pipelines/monthly-check";
import type { ApiResponse } from "@/types";

const BATCH_SIZE = 5;

interface CheckResult {
  clientId: string;
  status: "success" | "error";
  score?: number;
  error?: string;
}

function verifyCronSecret(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

async function handleMonthlyCheck(
  request: NextRequest
): Promise<
  NextResponse<
    ApiResponse<{
      processed: number;
      results: CheckResult[];
      nextCursor: string | null;
    }>
  >
> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/monthly-check] CRON_SECRET not configured");
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

    const clients = await prisma.client.findMany({
      where: {
        plan: { in: ["starter", "growth"] },
        onboardingStatus: { in: ["setup_complete", "active"] },
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true },
    });

    const results: CheckResult[] = [];
    for (const client of clients) {
      try {
        const result = await runMonthlyCheck(client.id);
        results.push({
          clientId: client.id,
          status: "success" as const,
          score: result.newScore,
        });
      } catch (error) {
        console.error(`[Monthly Check] Failed for ${client.id}:`, error);
        results.push({
          clientId: client.id,
          status: "error" as const,
          error: "Monthly check failed",
        });
      }
    }

    const nextCursor =
      clients.length === BATCH_SIZE
        ? clients[clients.length - 1].id
        : null;

    return NextResponse.json({
      data: { processed: results.length, results, nextCursor },
    });
  } catch (error) {
    console.error("[cron/monthly-check]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Vercel cron sends GET requests
export const GET = handleMonthlyCheck;
export const POST = handleMonthlyCheck;

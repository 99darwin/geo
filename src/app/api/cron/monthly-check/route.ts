import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { runMonthlyCheck } from "@/lib/pipelines/monthly-check";
import type { ApiResponse } from "@/types";

const BATCH_SIZE = 50;

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
      nextCursor?: string;
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
    // Support cursor from query params (self-trigger) or request body (manual POST)
    const cursor =
      request.nextUrl.searchParams.get("cursor") ??
      (request.method === "POST"
        ? await request.json().then((b) => b.cursor).catch(() => null)
        : null);

    const clients = await prisma.client.findMany({
      where: {
        plan: { in: ["starter", "growth"] },
        onboardingStatus: { in: ["setup_complete", "active"] },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
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

    // Self-trigger next batch if we hit the limit
    const nextCursor =
      clients.length === BATCH_SIZE
        ? clients[clients.length - 1].id
        : undefined;

    if (nextCursor) {
      console.log(
        `[cron/monthly-check] Batch limit reached, triggering next page from cursor ${nextCursor}`
      );
      try {
        const { waitUntil } = await import("@vercel/functions");
        const selfUrl = new URL(request.url);
        selfUrl.searchParams.set("cursor", nextCursor);
        waitUntil(
          fetch(selfUrl.toString(), {
            method: "GET",
            headers: { authorization: `Bearer ${cronSecret}` },
          }).catch((err) =>
            console.error("[cron/monthly-check] Self-trigger failed:", err)
          )
        );
      } catch {
        console.warn(
          "[cron/monthly-check] waitUntil unavailable; remaining clients will be processed next cron run"
        );
      }
    }

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

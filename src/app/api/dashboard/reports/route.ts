import { NextRequest, NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

interface ReportListItem {
  id: string;
  url: string;
  score: number;
  createdAt: string;
}

interface ReportsData {
  reports: ReportListItem[];
  nextCursor: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ONE_MINUTE_MS = 60 * 1000;
const checkRateLimit = rateLimit({ interval: ONE_MINUTE_MS, limit: 60 });

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<ReportsData>>> {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId || !UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  const userId = auth.session.user.id;

  const { success } = await checkRateLimit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 50);

  try {
    // Validate cursor belongs to this client to prevent cross-tenant probing
    if (cursor) {
      if (!UUID_RE.test(cursor)) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
      const cursorReport = await prisma.scanReport.findFirst({
        where: { id: cursor, clientId },
        select: { id: true },
      });
      if (!cursorReport) {
        return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
      }
    }

    const reports = await prisma.scanReport.findMany({
      where: { clientId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, url: true, score: true, createdAt: true },
    });

    const hasMore = reports.length > limit;
    const results = hasMore ? reports.slice(0, limit) : reports;

    return NextResponse.json({
      data: {
        reports: results.map((r) => ({
          id: r.id,
          url: r.url,
          score: r.score,
          createdAt: r.createdAt.toISOString(),
        })),
        nextCursor: hasMore ? results[results.length - 1].id : null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/dashboard/reports]", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

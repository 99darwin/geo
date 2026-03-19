import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

interface CitationHistoryItem {
  id: string;
  platform: string;
  cited: boolean;
  position: number | null;
  queryText: string;
  checkedAt: string;
}

interface HistoryData {
  citations: CitationHistoryItem[];
  nextCursor: string | null;
  total: number;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<HistoryData>>> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

  try {
    const client = await prisma.client.findFirst({
      where: { userId: auth.session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "No client found" }, { status: 404 });
    }

    const where: Record<string, unknown> = { clientId: client.id };
    if (platform) where.platform = platform;

    const total = await prisma.citation.count({ where });

    const citations = await prisma.citation.findMany({
      where,
      orderBy: { checkedAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { query: { select: { queryText: true } } },
    });

    const hasMore = citations.length > limit;
    const results = hasMore ? citations.slice(0, limit) : citations;

    return NextResponse.json({
      data: {
        citations: results.map(
          (c: {
            id: string;
            platform: string;
            cited: boolean;
            position: number | null;
            query: { queryText: string };
            checkedAt: Date;
          }) => ({
            id: c.id,
            platform: c.platform,
            cited: c.cited,
            position: c.position,
            queryText: c.query.queryText,
            checkedAt: c.checkedAt.toISOString(),
          })
        ),
        nextCursor: hasMore ? results[results.length - 1].id : null,
        total,
      },
    });
  } catch (error) {
    console.error("[GET /api/dashboard/history]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

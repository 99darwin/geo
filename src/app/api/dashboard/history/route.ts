import { NextRequest, NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/auth-utils";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<HistoryData>>> {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId || !UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  const platform = searchParams.get("platform");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 50);

  // Validate cursor format and ownership
  if (cursor) {
    if (!UUID_RE.test(cursor)) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    const cursorCitation = await prisma.citation.findUnique({
      where: { id: cursor },
      select: { clientId: true },
    });
    if (!cursorCitation || cursorCitation.clientId !== clientId) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
  }

  try {
    const where: Record<string, unknown> = { clientId };
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

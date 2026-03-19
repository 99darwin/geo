import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

interface DashboardData {
  client: {
    id: string;
    businessName: string;
    websiteUrl: string;
    city: string;
    state: string | null;
    category: string | null;
    plan: string;
    onboardingStatus: string;
  };
  visibilityScore: {
    score: number;
    queryCoverage: number;
    platformCoverage: number;
    period: string;
    breakdown: Record<string, unknown>;
  } | null;
  recentCitations: {
    id: string;
    platform: string;
    cited: boolean;
    position: number | null;
    queryText: string;
    checkedAt: string;
  }[];
  generatedFiles: {
    llmsTxt: boolean;
    schemaJson: boolean;
  };
}

export async function GET(
  _request: NextRequest
): Promise<NextResponse<ApiResponse<DashboardData>>> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await prisma.client.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!client) {
      return NextResponse.json(
        { error: "No client found for this user" },
        { status: 404 }
      );
    }

    // Fetch latest visibility score
    const latestScore = await prisma.visibilityScore.findFirst({
      where: { clientId: client.id },
      orderBy: { period: "desc" },
    });

    // Fetch recent citations with query text
    const recentCitations = await prisma.citation.findMany({
      where: { clientId: client.id },
      orderBy: { checkedAt: "desc" },
      take: 20,
      include: {
        query: { select: { queryText: true } },
      },
    });

    // Check generated files status
    const activeFiles = await prisma.generatedFile.findMany({
      where: { clientId: client.id, isActive: true },
      select: { fileType: true },
    });

    const fileTypes = new Set(activeFiles.map((f: { fileType: string }) => f.fileType));

    const data: DashboardData = {
      client: {
        id: client.id,
        businessName: client.businessName,
        websiteUrl: client.websiteUrl,
        city: client.city,
        state: client.state,
        category: client.category,
        plan: client.plan,
        onboardingStatus: client.onboardingStatus,
      },
      visibilityScore: latestScore
        ? {
            score: latestScore.score,
            queryCoverage: latestScore.queryCoverage,
            platformCoverage: latestScore.platformCoverage,
            period: latestScore.period.toISOString(),
            breakdown: latestScore.breakdown as Record<string, unknown>,
          }
        : null,
      recentCitations: recentCitations.map(
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
      generatedFiles: {
        llmsTxt: fileTypes.has("llms_txt"),
        schemaJson: fileTypes.has("schema_json"),
      },
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

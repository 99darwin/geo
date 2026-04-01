import { NextRequest, NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { generateRecommendations } from "@/lib/engines/recommendations";
import type { ApiResponse, Recommendation } from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DashboardData {
  client: {
    id: string;
    businessName: string;
    websiteUrl: string;
    city: string | null;
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
  scoreHistory: { period: string; score: number }[];
  recommendations: Recommendation[];
  competitors: {
    id: string;
    name: string;
    domain: string | null;
    citedCount: number;
    platforms: string[];
    isAutoDetected: boolean;
  }[];
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<DashboardData>>> {
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId || !UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json(
        { error: "No client found" },
        { status: 404 }
      );
    }

    // Parallel queries for dashboard data
    const [
      latestScore,
      recentCitations,
      activeFiles,
      scoreHistory,
      competitors,
      napResults,
      reviewSnapshots,
    ] = await Promise.all([
      prisma.visibilityScore.findFirst({
        where: { clientId: client.id },
        orderBy: { period: "desc" },
      }),
      prisma.citation.findMany({
        where: { clientId: client.id },
        orderBy: { checkedAt: "desc" },
        take: 200,
        include: { query: { select: { queryText: true } } },
      }),
      prisma.generatedFile.findMany({
        where: { clientId: client.id, isActive: true },
        select: { fileType: true },
      }),
      prisma.visibilityScore.findMany({
        where: { clientId: client.id },
        orderBy: { period: "asc" },
        take: 12,
        select: { period: true, score: true },
      }),
      prisma.competitor.findMany({
        where: { clientId: client.id },
        take: 5,
        orderBy: {
          competitorCitations: { _count: "desc" },
        },
        include: {
          competitorCitations: {
            where: { cited: true },
            select: { platform: true },
          },
        },
      }),
      prisma.napAudit.findMany({
        where: { clientId: client.id },
        orderBy: { checkedAt: "desc" },
        distinct: ["platform"],
      }),
      prisma.reviewSnapshot.findMany({
        where: { clientId: client.id },
        orderBy: { checkedAt: "desc" },
        distinct: ["platform"],
      }),
    ]);

    const fileTypes = new Set(activeFiles.map((f: { fileType: string }) => f.fileType));

    // Compute citation stats for recommendations
    const citedQueries = new Set(
      recentCitations.filter((c) => c.cited).map((c) => c.query.queryText)
    );
    const totalQueries = new Set(recentCitations.map((c) => c.query.queryText));
    const platformsCiting = [
      ...new Set(recentCitations.filter((c) => c.cited).map((c) => c.platform)),
    ];

    // Read robots.txt status from latest score breakdown (set during monthly check)
    const breakdown = (latestScore?.breakdown as Record<string, unknown>) ?? {};
    const hasCleanRobotsTxt = breakdown.hasCleanRobotsTxt !== false;
    const robotsAudit = {
      accessible: true,
      blocked: hasCleanRobotsTxt ? [] : ["unknown"],
      total: 5,
      status: hasCleanRobotsTxt ? "clean" : "blocked",
    };

    const recommendations = generateRecommendations({
      robotsAudit,
      hasLlmsTxt: fileTypes.has("llms_txt"),
      hasSchema: fileTypes.has("schema_json"),
      citedQueryCount: citedQueries.size,
      totalQueryCount: totalQueries.size,
      platformsCiting,
      totalPlatforms: 3,
      napResults: napResults.map((n) => ({
        platform: n.platform,
        nameMatch: n.nameMatch,
        addressMatch: n.addressMatch,
        phoneMatch: n.phoneMatch,
        listingUrl: n.listingUrl ?? undefined,
        issues: n.issues,
      })),
      reviewSnapshots: reviewSnapshots.map((r) => ({
        platform: r.platform,
        rating: r.rating,
        reviewCount: r.reviewCount,
      })),
    });

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
      scoreHistory: scoreHistory.map((s) => ({
        period: s.period.toISOString(),
        score: s.score,
      })),
      recommendations,
      competitors: competitors.map((c) => ({
        id: c.id,
        name: c.competitorName,
        domain: c.competitorUrl,
        citedCount: c.competitorCitations.length,
        platforms: [...new Set(c.competitorCitations.map((cc) => cc.platform))],
        isAutoDetected: c.isAutoDetected,
      })),
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

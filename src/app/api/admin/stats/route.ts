import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

interface StatsData {
  totalClients: number;
  activeSubscriptions: number;
  avgScore: number | null;
  pendingSetup: number;
  recentClients: {
    id: string;
    businessName: string;
    city: string;
    plan: string;
    createdAt: string;
  }[];
}

export async function GET(
  _request: NextRequest
): Promise<NextResponse<ApiResponse<StatsData>>> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const [totalClients, activeSubscriptions, pendingSetup, scoreAgg, recentClients] =
      await Promise.all([
        prisma.client.count(),
        prisma.client.count({
          where: { plan: { not: "free_scan" } },
        }),
        prisma.client.count({
          where: { onboardingStatus: "setup_pending" },
        }),
        prisma.visibilityScore.aggregate({
          _avg: { score: true },
        }),
        prisma.client.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            businessName: true,
            city: true,
            plan: true,
            createdAt: true,
          },
        }),
      ]);

    return NextResponse.json({
      data: {
        totalClients,
        activeSubscriptions,
        avgScore: scoreAgg._avg.score,
        pendingSetup,
        recentClients: recentClients.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })),
      },
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[GET /api/admin/stats]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

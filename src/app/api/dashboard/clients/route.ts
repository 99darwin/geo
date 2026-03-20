import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

interface ClientListItem {
  id: string;
  businessName: string;
  websiteUrl: string;
  city: string;
  state: string | null;
  category: string | null;
  plan: string;
  onboardingStatus: string;
  latestScore: number | null;
  createdAt: string;
}

export async function GET(
  _request: NextRequest
): Promise<NextResponse<ApiResponse<{ clients: ClientListItem[] }>>> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const clients = await prisma.client.findMany({
      where: { userId: auth.session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        visibilityScores: {
          orderBy: { period: "desc" },
          take: 1,
          select: { score: true },
        },
      },
    });

    return NextResponse.json({
      data: {
        clients: clients.map((c) => ({
          id: c.id,
          businessName: c.businessName,
          websiteUrl: c.websiteUrl,
          city: c.city,
          state: c.state,
          category: c.category,
          plan: c.plan,
          onboardingStatus: c.onboardingStatus,
          latestScore: c.visibilityScores[0]?.score ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/dashboard/clients]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

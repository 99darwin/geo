import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

interface ClientListItem {
  id: string;
  businessName: string;
  city: string | null;
  state: string | null;
  plan: string;
  onboardingStatus: string;
  latestScore: number | null;
  createdAt: string;
}

interface ClientListData {
  clients: ClientListItem[];
  total: number;
  page: number;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<ClientListData>>> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const plan = searchParams.get("plan");
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

  try {
    const where: Record<string, unknown> = {};
    if (search) {
      where.businessName = { contains: search, mode: "insensitive" };
    }
    if (plan) where.plan = plan;
    if (status) where.onboardingStatus = status;

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          visibilityScores: {
            orderBy: { period: "desc" },
            take: 1,
            select: { score: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        clients: clients.map((c) => ({
          id: c.id,
          businessName: c.businessName,
          city: c.city,
          state: c.state,
          plan: c.plan,
          onboardingStatus: c.onboardingStatus,
          latestScore: c.visibilityScores[0]?.score ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
        total,
        page,
      },
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[GET /api/admin/clients]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

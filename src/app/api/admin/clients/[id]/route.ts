import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        businessName: true,
        websiteUrl: true,
        city: true,
        state: true,
        phone: true,
        address: true,
        category: true,
        services: true,
        hours: true,
        googleBusinessUrl: true,
        plan: true,
        onboardingStatus: true,
        createdAt: true,
        updatedAt: true,
        // Intentionally omit: stripeCustomerId, stripeSubscriptionId, userId
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        visibilityScores: {
          orderBy: { period: "desc" },
          take: 12,
          select: { id: true, score: true, queryCoverage: true, platformCoverage: true, period: true, breakdown: true },
        },
        citations: {
          orderBy: { checkedAt: "desc" },
          take: 20,
          select: {
            id: true, platform: true, cited: true, position: true, checkedAt: true,
            query: { select: { queryText: true } },
          },
        },
        generatedFiles: {
          where: { isActive: true },
          select: { id: true, fileType: true, version: true, createdAt: true },
        },
        adminNotes: {
          orderBy: { createdAt: "desc" },
          select: { id: true, author: true, content: true, createdAt: true },
        },
        competitors: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, competitorName: true, competitorUrl: true },
        },
        queries: {
          where: { active: true },
          select: { id: true, queryText: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ data: client }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[GET /api/admin/clients/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const updateSchema = z.object({
  plan: z.enum(["free_scan", "starter", "growth"]).optional(),
  onboardingStatus: z
    .enum(["scan_complete", "setup_pending", "setup_complete", "active"])
    .optional(),
  businessName: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  category: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    await prisma.client.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[PATCH /api/admin/clients/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

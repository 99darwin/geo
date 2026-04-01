import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireClientOwner } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_COMPETITORS = 10;

const createCompetitorSchema = z.object({
  clientId: z.string().regex(UUID_RE, "Invalid clientId"),
  competitorName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or fewer"),
  competitorUrl: z.string().url("Invalid URL").optional(),
});

export async function GET(request: NextRequest) {
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId || !UUID_RE.test(clientId)) {
    return NextResponse.json(
      { error: "clientId is required" },
      { status: 400 }
    );
  }

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  try {
    const competitors = await prisma.competitor.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: competitors });
  } catch (error) {
    console.error("[GET /api/dashboard/competitors]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = createCompetitorSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { clientId, competitorName, competitorUrl } = parsed.data;

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  try {
    const existingCount = await prisma.competitor.count({
      where: { clientId },
    });
    if (existingCount >= MAX_COMPETITORS) {
      return NextResponse.json(
        { error: "Maximum 10 competitors allowed" },
        { status: 400 }
      );
    }

    const duplicate = await prisma.competitor.findFirst({
      where: {
        clientId,
        competitorName: { equals: competitorName, mode: "insensitive" },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Competitor with this name already exists" },
        { status: 400 }
      );
    }

    const competitor = await prisma.competitor.create({
      data: {
        clientId,
        competitorName,
        competitorUrl: competitorUrl ?? null,
        isAutoDetected: false,
      },
    });

    return NextResponse.json({ data: competitor }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/dashboard/competitors]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

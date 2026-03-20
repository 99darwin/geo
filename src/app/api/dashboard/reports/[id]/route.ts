import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import type { ApiResponse, ScanResult } from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ONE_MINUTE_MS = 60 * 1000;
const checkRateLimit = rateLimit({ interval: ONE_MINUTE_MS, limit: 60 });

// Runtime validation for the ScanResult JSON blob
const scanResultSchema = z.object({
  score: z.number(),
  breakdown: z.object({
    queryCoverage: z.number(),
    platformCoverage: z.number(),
    positionQuality: z.number(),
    setupComplete: z.number(),
    total: z.number(),
  }),
  platforms: z.array(
    z.object({
      platform: z.string(),
      queriesChecked: z.number(),
      citedCount: z.number(),
    })
  ),
  queries: z.array(
    z.object({
      query: z.string(),
      results: z.array(
        z.object({
          platform: z.string(),
          cited: z.boolean(),
          position: z.number().nullable(),
        })
      ),
    })
  ),
  topSources: z.array(
    z.object({
      domain: z.string(),
      citationCount: z.number(),
    })
  ),
  competitor: z
    .object({
      name: z.string(),
      url: z.string().nullable(),
    })
    .nullable(),
  businessInfo: z.object({
    name: z.string(),
    category: z.string().nullable(),
    city: z.string().nullable(),
  }),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ScanResult>>> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const userId = auth.session.user.id;

  const { success } = await checkRateLimit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const { id } = await params;

  // Validate UUID format before querying
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  try {
    const client = await prisma.client.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "No client found" }, { status: 404 });
    }

    const report = await prisma.scanReport.findFirst({
      where: { id, clientId: client.id },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Validate the stored JSON matches expected shape
    const parsed = scanResultSchema.safeParse(report.data);
    if (!parsed.success) {
      console.error("[GET /api/dashboard/reports/[id]] Malformed report data:", report.id);
      return NextResponse.json(
        { error: "Report data is corrupted" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: parsed.data as ScanResult });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[GET /api/dashboard/reports/[id]]", msg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

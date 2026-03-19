import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { ApiResponse } from "@/types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const checkRateLimit = rateLimit({ interval: ONE_MINUTE_MS, limit: 10 });

const MAX_BODY_BYTES = 100 * 1024; // 100KB

const shareSchema = z.object({
  data: z.object({
    score: z.number(),
    breakdown: z.object({
      queryCoverage: z.number(),
      platformCoverage: z.number(),
      positionQuality: z.number(),
      setupComplete: z.number(),
      total: z.number(),
    }),
    platforms: z
      .array(
        z.object({
          platform: z.string().max(50),
          queriesChecked: z.number(),
          citedCount: z.number(),
        })
      )
      .max(10),
    queries: z
      .array(
        z.object({
          query: z.string().max(500),
          results: z
            .array(
              z.object({
                platform: z.string().max(50),
                cited: z.boolean(),
                position: z.number().nullable(),
              })
            )
            .max(10),
        })
      )
      .max(50),
    topSources: z
      .array(
        z.object({
          domain: z.string().max(200),
          citationCount: z.number(),
        })
      )
      .max(50),
    competitor: z
      .object({
        name: z.string().max(200),
        url: z.string().max(500).nullable(),
      })
      .nullable(),
    businessInfo: z.object({
      name: z.string().max(200),
      category: z.string().max(100).nullable(),
      city: z.string().max(100).nullable(),
    }),
  }),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ token: string; url: string }>>> {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous";
  const { success } = checkRateLimit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report data" }, { status: 400 });
  }

  try {
    const report = await prisma.sharedReport.create({
      data: {
        data: JSON.parse(JSON.stringify(parsed.data.data)),
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    return NextResponse.json({
      data: {
        token: report.token,
        url: `${baseUrl}/report/${report.token}`,
      },
    });
  } catch (error) {
    console.error("[POST /api/reports/share]", error);
    return NextResponse.json(
      { error: "Failed to create shared report" },
      { status: 500 }
    );
  }
}

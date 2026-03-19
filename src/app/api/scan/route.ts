import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { rateLimit } from "@/lib/rate-limit";
import { runFreeScan } from "@/lib/pipelines/free-scan";
import { TimeoutError } from "@/lib/utils";
import type { ApiResponse, ScanResult } from "@/types";

const scanSchema = z.object({
  url: z.string().transform((val) => {
    const trimmed = val.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }).pipe(z.url("Must be a valid URL")),
});

const ONE_HOUR_MS = 60 * 60 * 1000;
const checkRateLimit = rateLimit({ interval: ONE_HOUR_MS, limit: 5 });

export const maxDuration = 60;

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<ScanResult>>> {
  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Rate limit by IP
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "anonymous";
  const { success, remaining } = checkRateLimit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": "3600",
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  }

  // Run the free scan pipeline
  try {
    const result = await runFreeScan(parsed.data.url);
    return NextResponse.json(
      { data: result },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      return NextResponse.json(
        { error: "Scan timed out. Please try again." },
        { status: 504 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[POST /api/scan] Pipeline error:", errorMessage);

    const userMessage = errorMessage.includes("is not configured")
      ? "Service configuration error. Please contact support."
      : "Scan failed. Please try again later.";

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { rateLimit } from "@/lib/rate-limit";
import { runFreeScan } from "@/lib/pipelines/free-scan";
import type { ApiResponse, ScanResult } from "@/types";

const scanSchema = z.object({
  url: z.url("Must be a valid URL"),
});

const ONE_HOUR_MS = 60 * 60 * 1000;
const checkRateLimit = rateLimit({ interval: ONE_HOUR_MS, limit: 5 });

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
    const isTimeout =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));

    if (isTimeout) {
      return NextResponse.json(
        { error: "Scan timed out. Please try again." },
        { status: 504 }
      );
    }

    console.error("[POST /api/scan] Pipeline error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during the scan." },
      { status: 500 }
    );
  }
}

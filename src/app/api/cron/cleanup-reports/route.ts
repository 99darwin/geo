import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ deleted: number }>>> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[POST /api/cron/cleanup-reports] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.sharedReport.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return NextResponse.json({ data: { deleted: result.count } });
  } catch (error) {
    console.error("[POST /api/cron/cleanup-reports]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

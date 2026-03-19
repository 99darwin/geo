import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ApiResponse, ScanResult } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse<ApiResponse<ScanResult>>> {
  const { token } = await params;

  if (!token || token.length > 100) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    const report = await prisma.sharedReport.findUnique({
      where: { token },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This report has expired" },
        { status: 410 }
      );
    }

    return NextResponse.json({ data: report.data as unknown as ScanResult });
  } catch (error) {
    console.error("[GET /api/reports/:token]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

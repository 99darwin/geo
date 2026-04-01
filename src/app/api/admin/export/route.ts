import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      visibilityScores: {
        orderBy: { period: "desc" },
        take: 1,
        select: { score: true },
      },
      _count: {
        select: {
          queries: { where: { active: true } },
        },
      },
    },
  });

  const headers = [
    "id",
    "businessName",
    "websiteUrl",
    "city",
    "state",
    "plan",
    "onboardingStatus",
    "latestScore",
    "activeQueries",
    "createdAt",
  ];

  const rows = clients.map((c) => [
    c.id,
    escapeCsv(c.businessName),
    escapeCsv(c.websiteUrl),
    c.city ? escapeCsv(c.city) : "",
    c.state ? escapeCsv(c.state) : "",
    c.plan,
    c.onboardingStatus,
    c.visibilityScores[0]?.score?.toString() ?? "",
    c._count.queries.toString(),
    c.createdAt.toISOString(),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="clients-export-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function escapeCsv(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    value = "'" + value;
  }
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

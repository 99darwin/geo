import { NextRequest, NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid competitor id" },
      { status: 400 }
    );
  }

  try {
    const competitor = await prisma.competitor.findUnique({
      where: { id },
      select: { id: true, clientId: true },
    });

    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found" },
        { status: 404 }
      );
    }

    const auth = await requireClientOwner(competitor.clientId);
    if (auth.error) return auth.error;

    await prisma.competitor.delete({ where: { id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("[DELETE /api/dashboard/competitors/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

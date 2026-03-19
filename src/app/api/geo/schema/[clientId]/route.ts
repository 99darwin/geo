import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const clientId = (await params).clientId;

  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  try {
    const file = await prisma.generatedFile.findFirst({
      where: {
        clientId,
        fileType: "schema_json",
        isActive: true,
      },
      orderBy: { version: "desc" },
    });

    if (!file) {
      return NextResponse.json(
        { error: "Schema script not found for this client" },
        { status: 404 }
      );
    }

    return new NextResponse(file.content, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[GET /api/geo/schema/[clientId]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

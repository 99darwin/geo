import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const { clientId } = await params;

  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  try {
    const file = await prisma.generatedFile.findFirst({
      where: {
        clientId,
        fileType: "llms_txt",
        isActive: true,
      },
      orderBy: { version: "desc" },
    });

    if (!file) {
      return NextResponse.json(
        { error: "llms.txt not found for this client" },
        { status: 404 }
      );
    }

    return new NextResponse(file.content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[GET /api/geo/llms/[clientId]/llms.txt]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

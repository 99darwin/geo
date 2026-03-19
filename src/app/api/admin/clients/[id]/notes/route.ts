import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

const noteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(5000, "Note must be 5000 characters or fewer"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ id: string; author: string; content: string; createdAt: string }>>> {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id: clientId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const author =
      auth.session.user.name ?? auth.session.user.email ?? "Admin";

    const note = await prisma.adminNote.create({
      data: {
        clientId,
        author,
        content: parsed.data.content,
      },
    });

    return NextResponse.json({
      data: {
        id: note.id,
        author: note.author,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/clients/[id]/notes]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

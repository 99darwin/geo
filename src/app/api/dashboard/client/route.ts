import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

const clientUpdateSchema = z.object({
  businessName: z.string().min(1).optional(),
  websiteUrl: z.url().optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  services: z.array(z.string()).optional(),
  hours: z.string().optional(),
  googleBusinessUrl: z.url().optional(),
});

export async function PATCH(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = clientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const client = await prisma.client.findFirst({
      where: { userId: auth.session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "No client found" }, { status: 404 });
    }

    await prisma.client.update({
      where: { id: client.id },
      data: parsed.data,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[PATCH /api/dashboard/client]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

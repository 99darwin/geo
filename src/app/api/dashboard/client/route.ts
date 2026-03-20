import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireClientOwner } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

const clientUpdateSchema = z.object({
  clientId: z.string().uuid(),
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

  const { clientId, ...updateData } = parsed.data;

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: updateData,
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

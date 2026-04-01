import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireClientOwner } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  clientId: z.string().regex(UUID_RE, "Invalid clientId"),
  businessName: z.string().min(1).max(200).optional(),
  category: z.string().max(200).optional(),
  serviceArea: z.enum(["local", "regional", "national", "global"]).optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
});

export async function PATCH(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ updated: boolean }>>> {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { clientId, ...updates } = parsed.data;

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  // Remove undefined values so we only update provided fields
  const data: Record<string, unknown> = {};
  if (updates.businessName !== undefined) data.businessName = updates.businessName;
  if (updates.category !== undefined) data.category = updates.category;
  if (updates.serviceArea !== undefined) data.serviceArea = updates.serviceArea;
  if (updates.city !== undefined) data.city = updates.city;
  if (updates.state !== undefined) data.state = updates.state;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  await prisma.client.update({
    where: { id: clientId },
    data,
  });

  return NextResponse.json({ data: { updated: true } });
}

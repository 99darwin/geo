import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import type { ApiResponse } from "@/types";

interface SettingsData {
  user: { name: string | null; email: string | null };
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const checkPasswordRateLimit = rateLimit({ interval: FIFTEEN_MINUTES_MS, limit: 5 });

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function GET(
  _request: NextRequest
): Promise<NextResponse<ApiResponse<SettingsData>>> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.session.user.id },
      select: { name: true, email: true },
    });

    return NextResponse.json({
      data: {
        user: { name: user?.name ?? null, email: user?.email ?? null },
      },
    });
  } catch (error) {
    console.error("[GET /api/dashboard/settings]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { name, currentPassword, newPassword } = parsed.data;

  try {
    const updateData: Record<string, string> = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (newPassword) {
      // Rate limit password changes to prevent brute-force attacks
      const { success: rateLimitOk } = await checkPasswordRateLimit(auth.session.user.id);
      if (!rateLimitOk) {
        return NextResponse.json(
          { error: "Too many password change attempts. Try again later." },
          { status: 429 }
        );
      }

      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: auth.session.user.id },
        select: { hashedPassword: true },
      });

      if (!user?.hashedPassword) {
        return NextResponse.json(
          { error: "Cannot change password for this account" },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(currentPassword, user.hashedPassword);
      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      updateData.hashedPassword = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: auth.session.user.id },
        data: updateData,
      });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("[PATCH /api/dashboard/settings]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

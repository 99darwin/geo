import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { ApiResponse } from "@/types";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Must be a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const ONE_HOUR_MS = 60 * 60 * 1000;
const checkRateLimit = rateLimit({ interval: ONE_HOUR_MS, limit: 10 });

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ id: string; email: string; name: string }>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous";
  const { success } = await checkRateLimit(`register:${ip}`);
  if (!success) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const { name, email, password } = parsed.data;

  // Check email uniqueness — use generic error to prevent account enumeration
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Unable to create account. Please try a different email or sign in." },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      hashedPassword,
      // role intentionally omitted — defaults to "user"
    },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({
    data: { id: user.id, email: user.email!, name: user.name! },
  });
}

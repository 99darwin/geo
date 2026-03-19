import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { prisma } from "./db";

type AuthResult =
  | { session: { user: { id: string; role: string; name?: string | null; email?: string | null } }; error?: never }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { session?: never; error: NextResponse<any> };

export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session: session as AuthResult extends { session: infer S } ? S : never };
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.error) return result;
  if (result.session.user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}

export async function requireClientOwner(
  clientId: string
): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.error) return result;

  // Admins can access any client
  if (result.session.user.role === "admin") return result;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { userId: true },
  });

  if (!client || client.userId !== result.session.user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return result;
}

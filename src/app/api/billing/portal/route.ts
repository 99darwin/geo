import { NextRequest, NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/auth-utils";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = (body as Record<string, unknown>)?.clientId;
  if (!clientId || typeof clientId !== "string" || !UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const auth = await requireClientOwner(clientId);
  if (auth.error) return auth.error;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { stripeCustomerId: true },
  });

  if (!client?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 404 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    console.error("[Billing Portal] NEXTAUTH_URL is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  try {
    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${baseUrl}/dashboard/${clientId}`,
    });

    return NextResponse.json({ data: { url: portalSession.url } });
  } catch (error) {
    console.error("[Billing Portal] Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}

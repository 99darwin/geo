import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";

const checkoutSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

const checkoutRateLimit = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 checkout sessions per user per hour
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await checkoutRateLimit(session.user.id);
  if (!success) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { url } = parsed.data;
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    console.error("[Checkout] NEXTAUTH_URL is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const setupPriceId = process.env.STRIPE_STARTER_SETUP_PRICE_ID;
  const monthlyPriceId = process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;

  if (!setupPriceId || !monthlyPriceId) {
    console.error("[Checkout] Missing Stripe price IDs");
    return NextResponse.json(
      { error: "Checkout is not configured" },
      { status: 500 }
    );
  }

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id,
        websiteUrl: url,
      },
      line_items: [
        { price: monthlyPriceId, quantity: 1 },
        { price: setupPriceId, quantity: 1 },
      ],
      subscription_data: {
        metadata: {
          userId: session.user.id,
          websiteUrl: url,
        },
      },
      success_url: `${baseUrl}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/onboarding`,
    });

    return NextResponse.json({ data: { url: checkoutSession.url } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Checkout] Failed to create session:", message);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

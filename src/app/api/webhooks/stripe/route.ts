import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { runSetupPipeline } from "@/lib/pipelines/setup";

function extractStripeId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const websiteUrl = session.metadata?.websiteUrl;

  if (!userId || !websiteUrl) {
    console.error("[Stripe Webhook] Missing metadata on checkout session:", session.id);
    return;
  }

  const customerId = extractStripeId(session.customer);
  const subscriptionId = extractStripeId(session.subscription);

  if (!customerId) {
    console.error("[Stripe Webhook] Missing customer ID on checkout session:", session.id);
    return;
  }

  // Validate user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error("[Stripe Webhook] User not found:", userId);
    return;
  }

  // Idempotent upsert: use stripeCustomerId unique constraint
  // If client already exists for this Stripe customer, skip creation
  const existing = await prisma.client.findUnique({
    where: { stripeCustomerId: customerId },
  });
  if (existing) {
    console.log("[Stripe Webhook] Client already exists for customer:", customerId);
    // If setup was interrupted, re-trigger it
    if (existing.onboardingStatus === "setup_pending") {
      console.log("[Stripe Webhook] Re-triggering setup for client:", existing.id);
      await runSetupPipeline(existing.id);
    }
    return;
  }

  const client = await prisma.client.create({
    data: {
      businessName: extractDomainName(websiteUrl),
      websiteUrl,
      city: "",
      plan: "starter",
      onboardingStatus: "setup_pending",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      userId,
    },
  });

  console.log("[Stripe Webhook] Client created:", client.id);

  // Run setup pipeline directly (in-process)
  // If this fails, the outer catch will return 500 so Stripe retries
  await runSetupPipeline(client.id);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const client = await prisma.client.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!client) {
    console.log("[Stripe Webhook] No client found for subscription:", subscription.id);
    return;
  }

  const status = subscription.status;
  console.log("[Stripe Webhook] Subscription status update:", subscription.id, "→", status);

  if (status === "canceled" || status === "unpaid") {
    await prisma.client.update({
      where: { id: client.id },
      data: { plan: "free_scan" },
    });
    console.log("[Stripe Webhook] Client downgraded to free_scan:", client.id);
  } else if (status === "past_due") {
    console.warn("[Stripe Webhook] Subscription past_due for client:", client.id);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const client = await prisma.client.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!client) {
    console.log("[Stripe Webhook] No client found for deleted subscription:", subscription.id);
    return;
  }

  await prisma.client.update({
    where: { id: client.id },
    data: {
      plan: "free_scan",
      onboardingStatus: "scan_complete",
      stripeSubscriptionId: null,
    },
  });

  console.log("[Stripe Webhook] Client churned:", client.id);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = extractStripeId(invoice.customer);
  if (!customerId) return;

  const client = await prisma.client.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!client) {
    console.log("[Stripe Webhook] No client found for customer:", customerId);
    return;
  }

  console.warn(
    "[Stripe Webhook] Payment failed for client:",
    client.id,
    "invoice:",
    invoice.id
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Signature verification failed";
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }
      default:
        console.log("[Stripe Webhook] Unhandled event type:", event.type);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe Webhook] Handler error:", event.type, message);
    // Return 500 so Stripe retries critical events
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

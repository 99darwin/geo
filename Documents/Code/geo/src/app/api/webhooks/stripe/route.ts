import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
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

  // Handle events — log for now, pipeline integration comes later
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(
        "[Stripe Webhook] checkout.session.completed:",
        session.id,
        "customer:",
        session.customer
      );
      // TODO: Create client record and trigger setup pipeline
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(
        "[Stripe Webhook] customer.subscription.updated:",
        subscription.id,
        "status:",
        subscription.status
      );
      // TODO: Update client plan status
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(
        "[Stripe Webhook] customer.subscription.deleted:",
        subscription.id
      );
      // TODO: Mark client as churned, stop monitoring
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(
        "[Stripe Webhook] invoice.payment_failed:",
        invoice.id,
        "customer:",
        invoice.customer
      );
      // TODO: Flag client for follow-up
      break;
    }

    default:
      console.log("[Stripe Webhook] Unhandled event type:", event.type);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

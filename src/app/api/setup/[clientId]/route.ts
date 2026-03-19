import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { waitUntil } from "@vercel/functions";
import { runSetupPipeline } from "@/lib/pipelines/setup";

/**
 * Internal endpoint to trigger the setup pipeline for a client.
 * Called by the Stripe webhook handler after creating the client record.
 * Protected by SETUP_PIPELINE_SECRET — fails closed if secret is unset.
 *
 * Uses waitUntil to run the pipeline in the background so the response
 * returns immediately and the function isn't killed by serverless timeout.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
): Promise<NextResponse> {
  const { clientId } = await params;

  // Fail closed: reject all requests if secret is not configured
  const setupSecret = process.env.SETUP_PIPELINE_SECRET;
  if (!setupSecret) {
    console.error("[Setup API] SETUP_PIPELINE_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // Constant-time comparison to prevent timing attacks
  const authHeader = request.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${setupSecret}`);
  const actual = Buffer.from(authHeader);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  // Run pipeline in the background via waitUntil — returns 200 immediately
  // so the calling webhook handler isn't blocked.
  waitUntil(
    runSetupPipeline(clientId).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[Setup API] Pipeline failed for client:", clientId, message);
    })
  );

  return NextResponse.json({ data: { accepted: true } });
}

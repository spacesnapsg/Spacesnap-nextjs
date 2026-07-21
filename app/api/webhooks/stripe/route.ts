import { NextResponse } from "next/server";
import { constructStripeWebhookEvent, handleStripeWebhookEvent, StripeWebhookSignatureError } from "@/lib/stripe-webhooks";

// Needs Node's crypto for Stripe's signature verification — not edge-runtime
// safe, and every other Stripe-touching module in this codebase already
// assumes a Node runtime (lib/stripe.ts has no edge guard either).
export const runtime = "nodejs";

// Stripe webhooks — authenticated by signature (STRIPE_WEBHOOK_SECRET), not a
// session cookie. There is no logged-in user making this request; Stripe is.
// See lib/stripe-webhooks.ts for what each event type actually does.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ message: "Missing stripe-signature header." }, { status: 400 });
  }

  // Signature verification needs the exact raw bytes Stripe signed — must
  // read as text, not request.json(), which would re-serialize and break the
  // signature check.
  const payload = await request.text();

  let event;
  try {
    event = constructStripeWebhookEvent(payload, signature);
  } catch (error) {
    if (error instanceof StripeWebhookSignatureError) {
      return NextResponse.json({ message: "Invalid webhook signature." }, { status: 400 });
    }
    throw error;
  }

  await handleStripeWebhookEvent(event);

  return NextResponse.json({ received: true });
}

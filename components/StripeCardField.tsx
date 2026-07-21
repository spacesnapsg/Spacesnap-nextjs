"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Card collection happens client-side via Stripe Elements and only ever
// produces a PaymentMethod id (pm_...) — the raw card number never touches
// this app's own code or server. The existing server routes
// (POST /api/bookings, PATCH /api/bookings/[id]/modify) already accept a
// paymentMethodId and charge it server-side, so this replaces the old
// hardcoded pm_card_visa test token without any route changes.
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// null when the key isn't configured — consumers must check
// stripeConfigured and show a setup message instead of a broken card field.
let stripePromise: Promise<Stripe | null> | null = null;
export const stripeConfigured = Boolean(publishableKey);

function getStripePromise() {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

// Always mounts <Elements> — with stripe={null} when unconfigured — because
// useStripe()/useElements() throw when rendered outside an Elements context,
// and consumers call useCreateCardPaymentMethod unconditionally (hooks can't
// be conditional on stripeConfigured).
export function StripeElementsProvider({ children }: { children: React.ReactNode }) {
  return <Elements stripe={getStripePromise()}>{children}</Elements>;
}

export function StripeNotConfiguredNotice() {
  return (
    <p className="text-sm text-amber">
      Card payments are not configured — set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and restart the dev
      server.
    </p>
  );
}

// CardElement renders inside a Stripe-hosted iframe, so it can't read this
// app's CSS variables/Tailwind tokens — these hex values mirror
// tailwind.config.ts (body-text / hint-text / error-red) by hand.
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: "#e5e7eb",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      fontSize: "14px",
      "::placeholder": { color: "#6b7280" },
    },
    invalid: { color: "#ef4444", iconColor: "#ef4444" },
  },
};

export function CardEntryField({ label = "Card details" }: { label?: string }) {
  if (!stripeConfigured) return <StripeNotConfiguredNotice />;
  return (
    <div>
      <p className="text-sm text-muted-text mb-2">{label}</p>
      <div className="rounded border border-border bg-background px-3 py-3">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>
    </div>
  );
}

// Must be called from a component inside <StripeElementsProvider> that
// renders a <CardEntryField>. Throws with a user-displayable message on
// validation/decline; resolves to the pm_... id to send to the API.
export function useCreateCardPaymentMethod() {
  const stripe = useStripe();
  const elements = useElements();

  return async function createCardPaymentMethod(): Promise<string> {
    if (!stripe || !elements) {
      throw new Error("Payment form is still loading — try again in a moment.");
    }
    const card = elements.getElement(CardElement);
    if (!card) {
      throw new Error("Card field is not available.");
    }
    const result = await stripe.createPaymentMethod({ type: "card", card });
    if (result.error) {
      throw new Error(result.error.message ?? "Your card could not be processed.");
    }
    return result.paymentMethod.id;
  };
}

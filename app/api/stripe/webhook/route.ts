import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/db";
import { getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { planForPriceId } from "@/lib/billing/plans";
import { logError } from "@/lib/log";

// Public route (no auth context) — authenticated by the Stripe signature, so it
// MUST stay out of the middleware PROTECTED regex, like /api/webhooks/*. Reads
// the RAW body (req.text()) because constructEvent verifies against raw bytes.
export const dynamic = "force-dynamic";

function mapStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "incomplete":
      return "past_due";
    default: // canceled | unpaid | incomplete_expired | paused
      return "canceled";
  }
}

/** Upsert our Subscription row from a Stripe subscription object. */
async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Resolve org: prefer metadata, fall back to the stored customer id.
  const orgId =
    (sub.metadata?.orgId as string | undefined) ??
    (
      await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        select: { orgId: true },
      })
    )?.orgId;
  if (!orgId) return; // unknown org — nothing to sync

  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const canceled = sub.status === "canceled";
  const plan = canceled ? "FREE" : (planForPriceId(priceId) ?? "FREE");

  // The billing period lives on the subscription item (Stripe moved it off the
  // top-level Subscription object). Unix seconds → Date.
  const data = {
    plan,
    status: mapStatus(sub.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : new Date(),
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
  };

  await prisma.subscription.upsert({
    where: { orgId },
    create: { orgId, ...data },
    update: data,
  });
}

export async function POST(req: Request) {
  if (!isBillingConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break; // ignore unhandled event types
    }
  } catch (err) {
    // Return 500 so Stripe retries the delivery; capture for triage.
    logError("stripe-webhook", err, { eventType: event.type, eventId: event.id });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

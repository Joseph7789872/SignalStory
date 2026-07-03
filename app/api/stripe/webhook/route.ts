import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { planForPriceId, type PlanId } from "@/lib/billing/plans";
import { logError } from "@/lib/log";

// Public route (no auth context) — authenticated by the Stripe signature, so it
// MUST stay out of the middleware PROTECTED regex, like /api/webhooks/*. Reads
// the RAW body (req.text()) because constructEvent verifies against raw bytes.
export const dynamic = "force-dynamic";

/** Exported for the offline test (scripts/test-webhook-stripe.ts). */
export function mapStatus(stripeStatus: Stripe.Subscription.Status): string {
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

/**
 * Pure plan resolution: a canceled subscription always lands on FREE; otherwise
 * the price id decides (unknown price → FREE). Exported for the offline test.
 */
export function resolvePlan(
  stripeStatus: Stripe.Subscription.Status,
  priceId: string | null | undefined,
): PlanId {
  if (stripeStatus === "canceled") return "FREE";
  return planForPriceId(priceId) ?? "FREE";
}

/**
 * Upsert our Subscription row from a Stripe subscription object.
 * `eventCreated` (Stripe event timestamp, unix seconds) guards ordering: a
 * delivery older than the last one applied is skipped, so a late `updated`
 * can't overwrite a newer `deleted`.
 */
async function syncSubscription(
  sub: Stripe.Subscription,
  eventCreated: number,
): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Resolve org: prefer metadata, fall back to the stored customer id.
  const existing = await prisma.subscription.findFirst({
    where: {
      OR: [
        ...(sub.metadata?.orgId ? [{ orgId: sub.metadata.orgId as string }] : []),
        { stripeCustomerId: customerId },
      ],
    },
    select: { orgId: true, lastStripeEventAt: true },
  });
  const orgId = (sub.metadata?.orgId as string | undefined) ?? existing?.orgId;
  if (!orgId) return; // unknown org — nothing to sync

  const eventAt = new Date(eventCreated * 1000);
  if (existing?.lastStripeEventAt && existing.lastStripeEventAt > eventAt) {
    return; // stale out-of-order delivery — a newer event already applied
  }

  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;

  // The billing period lives on the subscription item (Stripe moved it off the
  // top-level Subscription object). Unix seconds → Date.
  const data = {
    plan: resolvePlan(sub.status, priceId),
    status: mapStatus(sub.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000)
      : new Date(),
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    lastStripeEventAt: eventAt,
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

  // Idempotency: Stripe delivers at-least-once. Claim the event id first; a
  // duplicate delivery hits the unique constraint and no-ops.
  try {
    await prisma.processedStripeEvent.create({ data: { id: event.id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    logError("stripe-webhook", err, { eventType: event.type, eventId: event.id });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
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
          await syncSubscription(sub, event.created);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(
          event.data.object as Stripe.Subscription,
          event.created,
        );
        break;
      }
      default:
        break; // ignore unhandled event types
    }
  } catch (err) {
    // Return 500 so Stripe retries the delivery; capture for triage. Release
    // the idempotency claim so the retry isn't short-circuited as a duplicate.
    logError("stripe-webhook", err, { eventType: event.type, eventId: event.id });
    await prisma.processedStripeEvent
      .delete({ where: { id: event.id } })
      .catch(() => {});
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

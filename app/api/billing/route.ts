import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { getStripe, isBillingConfigured } from "@/lib/billing/stripe";
import { PLANS, toPlanId, type PlanId } from "@/lib/billing/plans";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

// Owner-gated billing actions. POST { action: "checkout", plan } returns a
// Stripe Checkout Session url; POST { action: "portal" } returns a Customer
// Portal url. Mirrors the 403/401 try-catch shape used across owner routes.

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("checkout"),
    plan: z.enum(["STARTER", "PRO"]),
  }),
  z.object({ action: z.literal("portal") }),
]);

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch (e) {
    const forbidden = e instanceof Error && e.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Owners only" : "Unauthorized" },
      { status: forbidden ? 403 : 401 },
    );
  }

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    // Ensure the org has a Stripe customer, reusing the stored id when present.
    const sub = await prisma.subscription.findUnique({
      where: { orgId: ctx.org.id },
    });
    let customerId = sub?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.user.email,
        name: ctx.org.name,
        metadata: { orgId: ctx.org.id },
      });
      customerId = customer.id;
      await prisma.subscription.upsert({
        where: { orgId: ctx.org.id },
        create: { orgId: ctx.org.id, stripeCustomerId: customerId },
        update: { stripeCustomerId: customerId },
      });
    }

    if (parsed.data.action === "portal") {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: appUrl("/settings"),
      });
      return NextResponse.json({ url: session.url });
    }

    // checkout
    const planId = parsed.data.plan as PlanId;
    const priceId = PLANS[toPlanId(planId)].priceId;
    if (!priceId) {
      return NextResponse.json(
        { error: `No Stripe price configured for ${planId}` },
        { status: 503 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: appUrl("/settings?checkout=success"),
      cancel_url: appUrl("/settings?checkout=cancel"),
      // Mirror orgId onto the subscription so the webhook can resolve it even if
      // the customer→org link is ever lost.
      subscription_data: { metadata: { orgId: ctx.org.id } },
      metadata: { orgId: ctx.org.id, plan: planId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logError("billing", err, { orgId: ctx.org.id, action: parsed.data.action });
    return NextResponse.json({ error: "Billing request failed" }, { status: 502 });
  }
}

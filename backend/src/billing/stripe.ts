import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

// Maps subscription price -> plan tier on the org record. Replace price IDs with yours.
export const PLAN_BY_PRICE: Record<string, string> = {
  price_solo: "solo", price_team: "team", price_brokerage: "brokerage",
  price_api_starter: "api_starter", price_api_growth: "api_growth", price_api_scale: "api_scale",
};

// Verify + handle Stripe webhooks (subscription.created/updated -> set org.plan; usage meters for AI/voice/mail).
export function constructEvent(rawBody: string, sig: string) {
  return stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
}

import "server-only";
import { unstable_cache } from "next/cache";
import { listSubscriptionPlans, type SubscriptionPlanOption } from "@/lib/store-tenant";
import { formatMoney } from "@/lib/money";
import { FEATURE_LABEL } from "./plan-features";

/**
 * The plans on the pricing pages – the platform's real, active plans (/cms → Plans). Until plans exist, the three plan
 * names are shown without prices or limits ("set by ShopEngine"), never invented numbers.
 */

export { ALL_FEATURES, FEATURE_LABEL } from "./plan-features";

export type PlanCard = {
  key: string;
  name: string;
  audience: string;
  price: string | null;
  priceNote: string;
  annual: string | null;
  /** yearly price (whole year) and how much it saves against 12 monthly payments, for the pricing toggle */
  annualPrice: string | null;
  annualSaving: number | null;
  trial: string | null;
  products: string;
  team: string;
  features: string[];
  recommended: boolean;
  configured: boolean;
};

const AUDIENCE = ["For a first online store", "For growing businesses", "For multi-store operations"];

const cached = unstable_cache(async () => listSubscriptionPlans().catch((): SubscriptionPlanOption[] => []), ["marketing-plans-v1"], { revalidate: 300, tags: ["plans"] });

const limit = (n: number | undefined, unit: string) => (!n ? `No ${unit} limit` : `Up to ${n.toLocaleString("en")} ${unit}${n === 1 ? "" : "s"}`);

export async function pricingPlans(): Promise<PlanCard[]> {
  const plans = await cached();
  if (!plans.length)
    return ["Starter", "Growth", "Scale"].map((name, i) => ({
      key: name.toLowerCase(),
      name,
      audience: AUDIENCE[i],
      price: null,
      priceNote: "Price set by ShopEngine",
      annual: null,
      annualPrice: null,
      annualSaving: null,
      trial: null,
      products: "Product limit set per plan",
      team: "Team limit set per plan",
      features: [],
      recommended: i === 1,
      configured: false,
    }));
  // the plan marked with a selling line, else the middle one
  const flagged = plans.findIndex((p) => p.highlight);
  const recommendedIndex = flagged >= 0 ? flagged : Math.min(1, plans.length - 1);
  return plans.map((p, i) => {
    const monthly = p.priceMonthly ?? 0;
    const annual = p.priceAnnual ?? 0;
    const trialDays = p.trialDays ?? 0;
    const money = { currency: p.currency || "USD", locale: "en" };
    return {
      key: p.slug || p.id,
      name: p.name,
      audience: p.highlight || p.description || AUDIENCE[Math.min(i, AUDIENCE.length - 1)],
      price: monthly > 0 ? formatMoney(monthly, money) : "Free",
      priceNote: monthly > 0 ? "per store / month" : "no monthly fee",
      annual: annual > 0 ? `${formatMoney(annual, money)} billed yearly` : null,
      annualPrice: annual > 0 ? formatMoney(annual, money) : null,
      annualSaving: annual > 0 && monthly > 0 && annual < monthly * 12 ? Math.round((1 - annual / (monthly * 12)) * 100) : null,
      trial: trialDays > 0 ? `${trialDays}-day free trial` : null,
      products: limit(p.maxProducts, "product"),
      team: limit(p.maxStaffMembers, "team member"),
      features: (p.features ?? []).filter((f) => FEATURE_LABEL[f]),
      recommended: i === recommendedIndex,
      configured: true,
    };
  });
}

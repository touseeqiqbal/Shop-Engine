/** Plan features as shown on the pricing pages (shared by the server pages and the pricing toggle in the browser). */
export const FEATURE_LABEL: Record<string, string> = {
  custom_domain: "Your own domain",
  online_payments: "Card payments (Stripe)",
  pos: "Shop counter (POS)",
  reports: "Advanced reports",
  discounts: "Discount codes",
  abandoned_carts: "Abandoned-cart recovery",
};
export const ALL_FEATURES = Object.keys(FEATURE_LABEL);

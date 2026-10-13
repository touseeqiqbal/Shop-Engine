"use server";
import { z } from "zod";
import { getOne, upsert } from "@/lib/repo/db";
import { isCmsConfigured } from "@/lib/db/config";
import { submitReview as submitCmsReview } from "@/lib/cms/catalog-source";
import { rateLimit } from "@/lib/rate-limit";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { randomUUID } from "node:crypto";
import { storePhotos } from "@/lib/uploads";
import { HONEYPOT } from "@/lib/honeypot";
import { log } from "@/lib/log";

export interface ReviewFormState {
  ok: boolean;
  message: string;
  errors?: Partial<Record<"name" | "city" | "rating" | "title" | "body", string>>;
}

const ReviewSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2, "Please enter your name").max(60, "Name is too long"),
  city: z.string().trim().max(60, "City is too long").optional().or(z.literal("")),
  rating: z.coerce.number().int().min(1, "Please choose a star rating").max(5, "Please choose a star rating"),
  title: z.string().trim().max(100, "Title is too long").optional().or(z.literal("")),
  body: z.string().trim().min(10, "Please write at least 10 characters").max(2000, "Review is too long (max 2000 characters)"),
});

/** Public review submission – validated, rate-limited and stored unapproved (moderated in the admin). */
export async function submitReview(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  // Honeypot: real users never fill this hidden field.
  if (String(formData.get(HONEYPOT) ?? "").trim()) {
    return { ok: true, message: "Thanks! Your review will appear after approval." };
  }
  if (!(await verifyTurnstile(formData, "review"))) return { ok: false, message: BOT_MESSAGE };

  const parsed = ReviewSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    city: formData.get("city") ?? "",
    rating: formData.get("rating") ?? 0,
    title: formData.get("title") ?? "",
    body: formData.get("body"),
  });

  if (!parsed.success) {
    const errors: ReviewFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<ReviewFormState["errors"]>;
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }

  if (!(await rateLimit("review", 3, 3600_000))) {
    return { ok: false, message: "You've submitted several reviews recently. Please try again in an hour." };
  }

  const d = parsed.data;
  try {
    if (isCmsConfigured) {
      // Saved to /cms → Reviews, unapproved until staff approve it
      const photos = await storePhotos(formData.getAll("photos"), "reviews-pending", randomUUID().slice(0, 12), 3);
      if ("error" in photos) return { ok: false, message: photos.error };
      const saved = await submitCmsReview(d.productId, { name: d.name, city: d.city || undefined, rating: d.rating, title: d.title || undefined, body: d.body, photoKeys: photos.keys });
      if (!saved) return { ok: false, message: "This product is no longer available for reviews." };
      return { ok: true, message: "Thanks! Your review will appear after approval." };
    }
    const product = await getOne("products", "id", d.productId);
    if (!product || product.status !== "active") return { ok: false, message: "This product is no longer available for reviews." };
    await upsert("reviews", {
      id: crypto.randomUUID(),
      productId: d.productId,
      name: d.name,
      city: d.city || undefined,
      rating: d.rating,
      title: d.title || undefined,
      body: d.body,
      approved: false,
      verified: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    log.error("reviews.submit_failed", err);
    return { ok: false, message: "Something went wrong. Please try again or message us on WhatsApp." };
  }

  return { ok: true, message: "Thanks! Your review will appear after approval." };
}

"use server";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { createTradeIn } from "@/lib/cms/engagement";
import { isCmsConfigured } from "@/lib/db/config";
import { notifyStaff } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { BOT_MESSAGE, verifyTurnstile } from "@/lib/turnstile";
import { storePhotos } from "@/lib/uploads";
import { normalizePkPhone } from "@/lib/utils";
import { HONEYPOT } from "@/lib/honeypot";

/** "Sell / trade in your laptop" form → /cms → Customers → Trade-ins. */

export type TradeInState = { ok?: boolean; message?: string; ts?: number };

const schema = z.object({
  brand: z.string().trim().min(2, "Enter the brand").max(40),
  model: z.string().trim().min(2, "Enter the model").max(80),
  processor: z.string().trim().max(60).optional(),
  ram: z.string().trim().max(30).optional(),
  storage: z.string().trim().max(40).optional(),
  batteryHealth: z.string().trim().max(30).optional(),
  condition: z.enum(["like-new", "good", "fair", "faulty"], { message: "Choose the condition" }),
  accessories: z.string().trim().max(200).optional(),
  faults: z.string().trim().max(1500).optional(),
  expectedPrice: z.coerce.number().int().min(0).max(5_000_000).optional(),
  wantsTradeIn: z.boolean(),
  name: z.string().trim().min(3, "Enter your name").max(80),
  phone: z.string().refine((v) => !!normalizePkPhone(v), "Enter a mobile number like 0300-1234567"),
  city: z.string().trim().max(60).optional(),
});

export async function submitTradeIn(_prev: TradeInState, fd: FormData): Promise<TradeInState> {
  const ts = Date.now();
  if (String(fd.get(HONEYPOT) ?? "")) return { ok: true, message: "Thanks! We'll call you soon.", ts };
  if (!isCmsConfigured) return { ok: false, message: "Please WhatsApp us the details instead.", ts };
  if (!(await verifyTurnstile(fd, "tradein"))) return { ok: false, message: BOT_MESSAGE, ts };
  const opt = (k: string) => String(fd.get(k) ?? "").trim() || undefined;
  const parsed = schema.safeParse({
    brand: fd.get("brand"),
    model: fd.get("model"),
    processor: opt("processor"),
    ram: opt("ram"),
    storage: opt("storage"),
    batteryHealth: opt("batteryHealth"),
    condition: fd.get("condition"),
    accessories: opt("accessories"),
    faults: opt("faults"),
    expectedPrice: opt("expectedPrice")?.replace(/[,\s]/g, ""),
    wantsTradeIn: fd.get("wantsTradeIn") === "on",
    name: fd.get("name"),
    phone: fd.get("phone"),
    city: opt("city"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, ts };
  if (!(await rateLimit("tradein", 4, 3600_000))) return { ok: false, message: "You've sent several requests – please WhatsApp us instead.", ts };
  const photos = await storePhotos(fd.getAll("photos"), "tradein", randomUUID().slice(0, 12), 6);
  if ("error" in photos) return { ok: false, message: photos.error, ts };
  const d = parsed.data;
  await createTradeIn({ ...d, phone: normalizePkPhone(d.phone), status: "new", photoKeys: photos.keys });
  after(() =>
    notifyStaff(`Trade-in: ${d.brand} ${d.model}`, [`${d.name} · ${d.phone}${d.city ? ` · ${d.city}` : ""}`, `${[d.processor, d.ram, d.storage].filter(Boolean).join(" / ")} – ${d.condition}`, d.expectedPrice ? `Expects Rs ${d.expectedPrice.toLocaleString("en-PK")}` : ""], {
      href: "/cms/collections/trade-ins?where[status][equals]=new",
      label: "Open trade-ins",
    })
  );
  return { ok: true, message: `Thanks ${d.name.split(" ")[0]}! We'll check the details and call or WhatsApp you with an offer, usually the same day.`, ts };
}

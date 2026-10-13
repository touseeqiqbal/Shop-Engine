import "server-only";
import { randomUUID } from "node:crypto";
import { isDatabaseConfigured } from "@/lib/db/config";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { WholesaleInquiry, WholesaleInquiryItem, WholesaleInquiryStatus } from "@/lib/types";
import { isCmsConfigured } from "@/lib/db/config";
import { saveInquiryCms } from "@/lib/cms/sales";

/**
 * Wholesale quote requests.
 * - Database mode: Prisma model `WholesaleInquiry` (table wholesale_inquiries).
 * - Demo mode: an in-memory array on globalThis (lost on restart), like contact messages.
 */

export type NewWholesaleInquiry = Omit<WholesaleInquiry, "id" | "createdAt" | "status" | "adminNotes">;

const g = globalThis as unknown as { __urkoWholesale?: WholesaleInquiry[] };
const memory = () => (g.__urkoWholesale ??= []);

type Row = {
  id: string;
  createdAt: Date;
  status: string;
  name: string;
  businessName: string | null;
  phone: string;
  email: string | null;
  city: string;
  buyerType: string;
  items: unknown;
  message: string | null;
  budget: string | null;
  adminNotes: string | null;
  source: string | null;
};

function fromRow(r: Row): WholesaleInquiry {
  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    status: r.status as WholesaleInquiryStatus,
    name: r.name,
    businessName: r.businessName ?? undefined,
    phone: r.phone,
    email: r.email ?? undefined,
    city: r.city,
    buyerType: r.buyerType as WholesaleInquiry["buyerType"],
    items: Array.isArray(r.items) ? (r.items as WholesaleInquiryItem[]) : [],
    message: r.message ?? undefined,
    budget: r.budget ?? undefined,
    adminNotes: r.adminNotes ?? undefined,
    source: r.source ?? undefined,
  };
}

export async function saveWholesaleInquiry(input: NewWholesaleInquiry): Promise<WholesaleInquiry> {
  const data = {
    name: input.name,
    businessName: input.businessName || null,
    phone: input.phone,
    email: input.email || null,
    city: input.city,
    buyerType: input.buyerType,
    message: input.message || null,
    budget: input.budget || null,
    source: input.source || null,
  };
  if (isCmsConfigured) return saveInquiryCms({ ...input, businessName: input.businessName || undefined, email: input.email || undefined, message: input.message || undefined, budget: input.budget || undefined, source: input.source || undefined });
  if (isDatabaseConfigured) {
    const row = await prisma.wholesaleInquiry.create({
      data: { ...data, status: "new", items: input.items as unknown as Prisma.InputJsonValue },
    });
    return fromRow(row as Row);
  }
  const inq: WholesaleInquiry = fromRow({
    ...data,
    id: randomUUID(),
    createdAt: new Date(),
    status: "new",
    items: structuredClone(input.items),
    adminNotes: null,
  });
  memory().unshift(inq);
  if (memory().length > 1000) memory().length = 1000;
  return structuredClone(inq);
}

export interface WholesaleListQuery {
  status?: WholesaleInquiryStatus | "all";
  q?: string;
  page?: number;
  perPage?: number;
}

export interface WholesaleListResult {
  items: WholesaleInquiry[];
  total: number;
  page: number;
  pages: number;
  /** counts per status for the current search (ignores the status filter) + "all" */
  counts: Record<WholesaleInquiryStatus | "all", number>;
}

/** All inquiries, newest first (used by the CSV export and the dashboard). */
export async function listAllWholesaleInquiries(): Promise<WholesaleInquiry[]> {
  if (isDatabaseConfigured) {
    const rows = await prisma.wholesaleInquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
    return (rows as Row[]).map(fromRow);
  }
  return structuredClone(memory()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

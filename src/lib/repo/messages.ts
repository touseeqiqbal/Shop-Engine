import "server-only";
import { randomUUID } from "node:crypto";
import { isDatabaseConfigured } from "@/lib/db/config";
import { prisma } from "@/lib/db/prisma";
import { isCmsConfigured } from "@/lib/db/config";
import { saveContactMessageCms } from "@/lib/cms/sales";
import { notifyFromStorefront } from "@/lib/notify";

/**
 * Contact form messages.
 * - Database mode: Prisma model `ContactMessage` (id, name, phone, email, subject, message, handled, createdAt).
 * - Demo mode: an in-memory array on globalThis (lost on restart).
 */

export interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  subject: string | null;
  message: string;
  handled: boolean;
  createdAt: string;
}

export type NewContactMessage = Pick<ContactMessage, "name" | "phone" | "message"> & { email?: string | null; subject?: string | null };

const g = globalThis as unknown as { __urkoMessages?: ContactMessage[] };
const memory = () => (g.__urkoMessages ??= []);

type Row = { id: string; name: string; phone: string; email: string | null; subject: string | null; message: string; handled: boolean; createdAt: Date };
const fromRow = (r: Row): ContactMessage => ({ ...r, createdAt: r.createdAt.toISOString() });

export async function saveContactMessage(input: NewContactMessage): Promise<ContactMessage> {
  const data = {
    name: input.name,
    phone: input.phone,
    email: input.email || null,
    subject: input.subject || null,
    message: input.message,
  };
  // The store's team is emailed (its /cms → Settings → Notifications).
  if (isCmsConfigured) {
    const doc = await saveContactMessageCms(data);
    await notifyFromStorefront("contact", { message: data });
    return { id: String(doc.id), ...data, handled: false, createdAt: String(doc.receivedAt ?? new Date().toISOString()) };
  }
  if (isDatabaseConfigured) {
    const row = await prisma.contactMessage.create({ data: { ...data, handled: false } });
    await notifyFromStorefront("contact", { message: data });
    return fromRow(row as Row);
  }
  const msg: ContactMessage = { id: randomUUID(), ...data, handled: false, createdAt: new Date().toISOString() };
  memory().unshift(msg);
  await notifyFromStorefront("contact", { message: data });
  if (memory().length > 500) memory().length = 500;
  return msg;
}

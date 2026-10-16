import type { TrackingStatus } from "../types";

/**
 * Couriers describe a parcel's state in their own words; this maps the words to ours. Order matters: "return" is
 * checked before "delivered" (a "Return delivered to shipper" is a return), "undelivered" / "unsuccessful" before
 * "delivered".
 */
export function statusFromText(text: string | null | undefined): TrackingStatus {
  const t = String(text ?? "").toLowerCase();
  if (!t.trim()) return "unknown";
  if (/cancel|expired|un-assigned|closed/.test(t)) return "cancelled";
  if (/return|rto|refused|being return|ready for return/.test(t)) return /returned to (shipper|sender|origin|merchant)|return confirm|returned$|^returned|rts\b/.test(t) ? "returned" : "in_transit";
  if (/undeliver|unsuccess|not deliver|attempt|pending|not home|bad address|incomplete|hold|review/.test(t)) return "failed";
  if (/deliver(ed)?\b/.test(t) && !/out for deliver|for delivery/.test(t)) return "delivered";
  if (/out for deliver|assign(ed)? to courier|with delivering courier|on route|on root/.test(t)) return "out_for_delivery";
  if (/unbooked|booked|pickup request|consignment booked|at merchant|awaiting pickup|information received/.test(t)) return "booked";
  return "in_transit";
}

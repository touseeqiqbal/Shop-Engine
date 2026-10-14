import type { GlobalConfig } from "payload";
import { adminUsers, platformAdmins } from "../access";
import { dbName } from "../fields";

/** Short how-to guides for the team, shown at /cms/help (editable here). One step per line. */

const DEFAULT_SECTIONS = [
  {
    title: "Sell at the shop counter (POS)",
    link: "/cms/pos",
    steps:
      "Open Shop counter → Sell (or press F2 to jump to the search box).\nScan the barcode on the laptop (serial number) or on the box (SKU). You can also type the name.\nFor laptops tracked by serial, pick the exact serial if you searched by name.\nChange the price or add a discount (Rs or %) if needed.\nChoose how the customer pays: Cash, Card, Bank, JazzCash or EasyPaisa. For cash, type what they handed you – the change is shown.\nPaying with two methods? Press “+ Split payment”.\nAdd the customer's phone for warranty, then press “Complete sale”.\nPrint the receipt. The sale comes off the same stock as the website straight away.\nMade a mistake? An owner or manager can press “Void” on today's sale – stock goes back.\nAt closing: Shop counter → Cash-up. Type the cash at opening and the cash you counted, then save.",
    tip: "If a serial number says “not in stock”, it was sold online or is in repair – check Products → Laptop units.",
  },
  {
    title: "Confirm cash-on-delivery orders",
    link: "/cms/collections/orders?where[status][equals]=awaiting-confirmation",
    steps:
      "New COD orders that need confirming show as “Waiting for customer” (Orders → Waiting for customer).\nThe customer gets a link and a 6-digit code by WhatsApp / SMS / email. When they confirm, the order moves to “To ship” by itself.\nNo answer? Open the order and press “Send link on WhatsApp” (opens WhatsApp with the message ready) or “Resend automatically”.\nIf you confirm on a phone call, press “Customer confirmed (by phone)”.\nOrders not confirmed in time are cancelled automatically and the stock goes back.\nCheck the risk badge on the order: “High risk” means past refusals or cancellations. Ask for an advance before shipping.\nA prank or repeat refuser? Press “Block this number” (block completely, or allow only with advance payment).",
    tip: "Change the rules in Settings → Fake order protection (which orders need confirming, how long they wait, risk points, cities that pay an advance).",
  },
  {
    title: "Ship an order with a courier",
    link: "/cms/collections/orders?where[status][equals]=confirmed",
    steps:
      "Open Orders → To ship.\nPrint the packing slip (button at the top of the order) and pack the items. Tick each item on the slip.\nBook the parcel on the courier's website or app (TCS, Leopards, M&P, Trax, PostEx…) – use the amount shown as “Rider collects” for COD.\nBack on the order press “Mark as shipped”, choose the courier and type the tracking number, then save. The customer gets the tracking link.\nWhen the rider has it, press “Out for delivery”; when it's delivered, “Mark as delivered”.\nThe customer refused the parcel? Press “Refused (RTO)” – stock goes back and it counts in their risk score and the RTO report.",
    tip: "Orders → Refused parcels (RTO) shows which cities, couriers and customers refuse most.",
  },
  {
    title: "Handle a return",
    link: "/cms/collections/return-requests?where[status][equals]=requested",
    steps:
      "Customers start returns at /returns with their order number and phone. New ones are in Orders → Returns → New.\nLook at the photos and reason. Press “Approve return” (or “Reject” and type why – the customer is told).\nWhen the item arrives press “Item received”, check it, then “Inspection done”.\nFinish with Refund, Replaced or Repaired.\nFor a refund choose the method (cash, bank, JazzCash, EasyPaisa or store credit) and amount. Tick “Put items back in stock” only if it can be sold again.\nA credit note is created – print it from the top of the return.",
    tip: "Return window, reasons and rules are in Settings → Returns & warranty rules – the website policy page updates by itself.",
  },
  {
    title: "Handle a warranty claim",
    link: "/cms/collections/warranty-claims?where[status][equals]=open",
    steps:
      "Claims come from /returns (Warranty claim) or you can add one in Orders → Warranty claims → Create new.\nType the serial number and / or order or shop receipt number – the warranty is checked automatically (bought on, months, ends on).\nGreen “In warranty” = covered. Red “Warranty ended” = tell the customer the repair cost first.\nPress “Item received”, then “Start repair” – the laptop shows as “In repair” in Laptop units.\nWhen done press “Repaired” (or “Replaced”), then “Given back to customer”.\nNot covered (damage, liquid)? Press “Not covered” and write why.",
    tip: "Write what you did in “What we did” – it stays with the serial number for next time.",
  },
];

export const StaffGuide: GlobalConfig = {
  slug: "staff-guide",
  dbName: dbName("staff-guide"),
  label: "Staff guide",
  admin: { group: "Settings", description: "The how-to guides on the Help page (/cms/help). One step per line." },
  access: { read: adminUsers, update: platformAdmins },
  fields: [
    {
      name: "sections",
      type: "array",
      labels: { singular: "Guide", plural: "Guides" },
      defaultValue: DEFAULT_SECTIONS,
      fields: [
        { type: "row", fields: [
          { name: "title", type: "text", required: true, admin: { width: "60%" } },
          { name: "link", type: "text", label: "Open button goes to", admin: { width: "40%" } },
        ] },
        { name: "steps", type: "textarea", required: true, admin: { rows: 8 } },
        { name: "tip", type: "text" },
      ],
    },
  ],
};

export const DEFAULT_GUIDE = DEFAULT_SECTIONS;

# Products – adding, editing, stock and prices

All in the admin at `/cms`, under **Products** in the left sidebar.

---

## 1. Add a laptop

1. **Products → All products → Create new** (or **+ Add → Add product** in the top bar).
2. Tab **Product**:
   1. **Product name** – e.g. "HP EliteBook 840 G8 – Core i5 11th Gen, 16GB, 512GB SSD".
   2. **Brand** and **Category** (both required). **Model** is optional (helps the "parts for your laptop" finder).
   3. **Short summary** – 1–2 lines shown near the price.
   4. **Full description** – the long text.
   5. **Photos** – click to upload or choose from the library. Add **at least 3**. Drag to reorder; **the first photo is the main one**.
   6. **Video link** (optional) – a YouTube link.
3. Tab **Pricing & stock**:
   1. **Price** in whole rupees.
   2. **Was price** (optional) – the old price, must be **higher** than Price. Shows a "Sale" badge.
   3. **Your cost** – only the Owner sees this. Used for the profit figure.
   4. **SKU** – your own stock code, must be unique (e.g. `HP840G8-I5-16-512`). Leave it empty and one is made from the name.
   5. **Stock** – how many you have. **Warn me at** – low-stock alert level (default 2).
   6. **Condition** – New / Used A+ / Used A / Refurbished / Open Box. **Warranty** text (e.g. "7 days checking warranty"). **Condition notes** – scratches etc. **What's in the box**.
   7. **Shipping class** and **weight** (used for delivery).
   8. **Price on request** – tick only for wholesale lots that can't be bought online.
4. Tab **Specs & compatibility**:
   1. **Specs** – add rows: label + value (Processor, RAM, Storage, Display, Graphics, Battery, Ports, OS…).
   2. **Attributes** – the filter values for this category (e.g. RAM = 16GB) so shoppers can filter.
   3. **Options & upgrades** (optional) – e.g. "RAM upgrade to 32GB +Rs 8,000".
   4. **Frequently bought together** (optional) – pick accessories.
5. Right-hand sidebar:
   1. Check the **Ready to sell** score – it lists what's missing.
   2. **Status**: leave **Draft – not on store yet** while you work. Switch to **On store** when ready.
   3. **Web address** fills itself from the name. If you change it later, the old address redirects automatically.
   4. Ticks: **featured**, **bestSeller**, **hotDeal** (+ deal end date).
   5. **Track each unit by serial number** – see section 3.
   6. **SEO** (below): title and description for Google. Leave empty to use the automatic ones. **Hide from search engines** keeps the page off Google; **Canonical URL** is only for a page that copies another one.
6. **Save draft / Publish:**
   - While you type, your changes are **saved as a draft automatically** (every few seconds) – nothing changes on the store yet.
   - **Preview** (the eye button, or the live-preview pane) shows the real product page with your draft – only you see it.
   - **Publish changes** puts them on the store. **Schedule publish** (arrow next to it) publishes at a date and time you pick.
   - **Versions** (top) lists earlier saves – open one and **Restore** to go back.
   - The **Status** (Draft / On store / Hidden) still decides whether shoppers see the product at all; a brand-new product only appears once it is **published** *and* set to **On store**.
   - Stock is always the live number: a draft never changes stock, and publishing an older draft never brings back an old stock figure.

## 2. Duplicate a product (for similar laptops)

1. Open the product → click **⋯** (top right) → **Duplicate**.
2. A safe copy opens: **Draft**, **stock 0**, no ratings / reviews / sales, "(copy)" after the name, its own SKU and web address.
3. Change the name, price, stock, specs and photos that differ, then set **On store** and **Publish**.

## 2b. Options (variants) – one product in several colours or sizes

For items sold in options (a sleeve in Black / Grey and 13" / 15", a mouse in three colours). Laptops with different specs stay separate products; "add 16GB RAM" style extras stay under **Options & upgrades**.

1. Open the main product → tab **Variants** → **Options**: add e.g. **Colour** with values Black, Grey (type a value, press Enter) and **Size** with 13 inch, 15 inch. **Save / Publish**.
2. Press **Create variants** – one product per combination appears in the table below (Black / 13 inch, Black / 15 inch …). They start with the main product's price, cost and photos, their own SKU, and **stock 0**.
3. Open each variant from the table to set its **stock**, and its price or photo if different. Pressing **Create variants** again only adds combinations that are missing (e.g. after adding a colour).
4. On the store, shoppers see the main product once ("From Rs …", **Choose options**) and pick the option on its page; price, stock and SKU follow their choice.
5. **Stock**: each variant has its own; the main product's stock is the total and can't be typed. Orders, the shop counter, returns, purchases and stock counts work on the variant (the main product itself can't be sold – "choose the option").
6. **Products → Variants** (tab) lists every variant, e.g. to see which colour runs low.

## 3. Units and serial numbers (laptops tracked one by one)

Use this for laptops where each machine is different (serial, condition, battery health).

1. On the product, tick **Track each unit by serial number** and save.
2. **Products → Laptop units (serials) → Create new**: scan or type the **Serial number**, pick the **product**, set **Warranty (months)**, **Condition of this unit**, **Your cost** (Owner only). Save.
3. The product's **stock now equals the number of units "In stock"** – you can't type the stock by hand any more.
4. When an online order is placed, a unit becomes **Reserved**; when it's delivered it becomes **Sold**. Shop-counter sales mark it **Sold** straight away.
5. Faster for many units: **Products → Purchases (stock in)** → add a line with the product, quantity, cost and **serial numbers (one per line)** → set status **Received (adds to stock)**.
6. Print barcode labels: **Laptop units** or **All products** list → tick items → **Print barcode labels**.

## 4. Update a price or stock quickly

1. **Products → All products**.
2. **Click the price or stock number in the list** and type the new value – it saves right there.
   **Prices** of existing products (price, was price, upgrade prices) can only be changed by **owners and managers**; staff see them read-only (staff can still set the price when they create a product).
3. Tabs at the top help: **Low stock**, **Out of stock**, **Drafts**, **Hidden**.
4. Products tracked by serial number show their stock as a link to their units instead.

## 5. Change many products at once (bulk)

**Same new value for several products** (e.g. set status, category, or the same price):
1. **Products → All products** → tick the products → **Edit** (top of the list).
2. Choose the field(s) to change, enter the value → **Save**.

**Different new prices for many products** (e.g. raise all prices by 5%): use CSV (section 6):
1. Export the products, change the `price` column in Excel / Google Sheets, import it back.

> There is no "increase all prices by X%" button. Use the CSV method above.

## 6. CSV import and export

1. **Products → Export** – choose the products (or the whole list) → download a CSV. **This is your template.**
2. Edit in Excel or Google Sheets. Keep the **`id`** column: rows with an id **update** that product; rows without an id **create** new products. Columns are field names: `title`, `sku`, `price`, `compareAtPrice`, `stock`, `status`, `brand`, `category`…
   **Stock of existing products is never changed by an import** – re-importing an older export would otherwise undo every sale since. The `stock` column only counts for **new** products. To correct stock, use **Stock count** or **Purchases** (section 8), or type it on the product.
3. Save as **CSV (UTF-8)**.
4. **Products → Import** → upload the file → check the preview → start the import.
5. Spot-check a few products afterwards.

Tips: categories, brands, laptop models and discount codes can be imported/exported the same way (⋯ menu on their lists). **Your cost** is only imported/exported for the Owner. Test with 2–3 rows first.

## 7. Categories, brands, collections

- **Products → Categories**: name, Urdu name, web address, parent category (for sub-categories), **Icon** (click one in the icon picker – it shows on the home-page category tiles), **Image** (the picture on the big tile when this category is first in the home-page Category grid; a transparent PNG looks best), short description, **SEO content** (text at the bottom of the category page), and **Filter attributes** (the filters shoppers see, e.g. RAM: 8GB/16GB/32GB).
- **Products → Brands**: name, web address, logo.
- **Products → Laptop models**: for the parts finder (e.g. "EliteBook 840 G8").
- **Products → Collections**: a page at `/collections/<handle>` – either **Hand-picked products** or **Automatic (rules)** like "brand = Dell and in stock". Tick **Published**.

## 8. Stock in, stock counts, suppliers

- **Products → Suppliers**: who you buy from.
- **Products → Purchases (stock in)**: record what you bought; **Received** adds it to stock (and serials). A received purchase is locked.
- **Products → Stock count**: start a count, scan everything on the shelf, review differences, then **Finish & correct stock** (managers).
- **Products → Inventory**: shortcut to low and out-of-stock products.

## 8b. Stock history – why did the stock change?

Every change of stock is recorded: open a product → **Stock history** (or **Products → Stock history**). Each line shows the change (−2, +1…), the stock after it, the reason (website order, order edited / cancelled / re-opened, return, shop-counter sale or void, purchase, stock count, edited in /cms, serial numbers) with the order / receipt / purchase number, and who did it. **Change history** on the product shows who changed its price, photos and other details. Kept for 2 years.

## 8c. Reports – Sales & profit

**Reports → Sales & profit** (owners and managers): sales from the website and the shop counter for any period, by product, category, brand, city, payment method and channel, with a day-by-day chart and **Download CSV**.
- **Booked** = orders that went ahead (confirmed, shipped, delivered) + counter sales. **Delivered** = money actually collected.
- Pending / unconfirmed, cancelled, refused (RTO) and returned orders are shown separately – never as sales.
- **Profit** (owners only) is on delivered sales: items − discounts − cost. The cost saved on each sale is used (a laptop's own cost for serial numbers). Older sales use today's "Your cost" and are marked "estimated"; products without a cost are listed so you can add it.

## 9. Photo tips

- Use **real photos** of the actual laptop on a plain, light background, in daylight.
- Take: front open, keyboard, side ports (both sides), lid, bottom/label, any marks. **First photo = best angle.**
- Landscape or square, at least **1200 px** wide. Phone photos are fine. Keep each file **under 5 MB**.
- JPG, PNG or WebP. Every photo is turned into WebP and resized automatically – this is normal and makes the site fast.
- File names don't matter (they're cleaned automatically).
- **Alt text** is required: describe that photo, e.g. "HP EliteBook 840 G8 – keyboard and screen". Don't copy the example text; describe *this* product.
- All photos are in **Online store → Photos & files**. Deleting a photo there removes it from every product that uses it.

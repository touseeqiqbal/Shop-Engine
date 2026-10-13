// Prints a JSON fingerprint (row count + md5 of all rows) of every table in the legacy `public` schema.
// Run before and after the Payload migration to prove the Prisma tables were not modified:
//   node scripts/migrate/fingerprint-legacy.mjs > before.json   …migrate…   node scripts/migrate/fingerprint-legacy.mjs > after.json
//   node scripts/migrate/fingerprint-legacy.mjs --compare before.json after.json
import fs from "node:fs";
import pg from "pg";

if (process.argv[2] === "--compare") {
  const [a, b] = [3, 4].map((i) => JSON.parse(fs.readFileSync(process.argv[i], "utf8")));
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  let changed = 0;
  for (const n of names) {
    const same = a[n] && b[n] && a[n].n === b[n].n && a[n].h === b[n].h;
    if (!same) changed++;
    console.log(`${same ? "unchanged" : "CHANGED  "}  ${n.padEnd(24)} ${a[n]?.n ?? "-"} → ${b[n]?.n ?? "-"}`);
  }
  console.log(changed ? `\n${changed} legacy table(s) differ!` : `\nAll ${names.length} legacy tables are identical.`);
  process.exit(changed ? 1 : 0);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const tables = (await c.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")).rows.map((r) => r.table_name);
const out = {};
for (const t of tables) {
  const r = await c.query(`select count(*)::int as n, md5(coalesce(string_agg(x::text, '|' order by x::text), '')) as h from "public"."${t}" x`);
  out[t] = r.rows[0];
}
console.log(JSON.stringify(out, null, 2));
await c.end();

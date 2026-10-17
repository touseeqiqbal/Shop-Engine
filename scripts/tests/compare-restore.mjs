/**
 * After a restore drill: the restored database must hold the same tables with the same number of rows as the one
 * that was backed up (CI restores the backup service's dump into an empty database and runs this).
 *
 *   node scripts/tests/compare-restore.mjs <original DATABASE_URL> <restored DATABASE_URL>
 */
import pg from "pg";

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error("usage: compare-restore.mjs <original url> <restored url>");
  process.exit(2);
}

async function counts(url) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const tables = (await c.query("select table_schema, table_name from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema') order by 1, 2")).rows;
    const out = new Map();
    for (const t of tables) {
      const name = `"${t.table_schema}"."${t.table_name}"`;
      out.set(name, Number((await c.query(`select count(*)::bigint as n from ${name}`)).rows[0].n));
    }
    return out;
  } finally {
    await c.end();
  }
}

const [a, b] = await Promise.all([counts(from), counts(to)]);
let failed = 0;
for (const [table, n] of a) {
  if (!b.has(table)) {
    console.log(`✗ ${table} missing after the restore`);
    failed++;
  } else if (b.get(table) !== n) {
    console.log(`✗ ${table}: ${n} rows backed up, ${b.get(table)} restored`);
    failed++;
  }
}
const rows = [...a.values()].reduce((s, n) => s + n, 0);
console.log(failed ? `Restore check FAILED (${failed})` : `Restore check passed – ${a.size} tables, ${rows} rows identical`);
process.exit(failed ? 1 : 0);

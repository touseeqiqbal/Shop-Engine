#!/usr/bin/env node
/**
 * CI guard for Payload migrations added or changed since BASE (a git ref; default HEAD~1).
 *
 * The old version keeps serving while the new one starts and applies its migrations – so a migration's up() must only
 * ADD things the old version can live with. Fails when a new/changed migration's up():
 *   - drops, renames or truncates something, or deletes rows,
 *   - changes a column's type, makes a column NOT NULL, or adds a NOT NULL column without a DEFAULT (the old version's
 *     saves would fail), or drops an index / constraint / default the old version relies on
 *     (all allowed only with a line `// allow-destructive: <why it is safe>` in that file – after a backup, see docs)
 *   - touches the legacy Prisma tables in the "public" schema  (never allowed – they are frozen)
 *
 * usage: BASE=origin/master node scripts/ci/check-migrations.mjs
 *        CHECK_MIGRATIONS_FILES=a.ts,b.ts node scripts/ci/check-migrations.mjs   (check these files – for testing the check)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const base = process.env.BASE || "HEAD~1";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

let changed;
if (process.env.CHECK_MIGRATIONS_FILES) changed = process.env.CHECK_MIGRATIONS_FILES.split(",").map((f) => f.trim());
else try {
  changed = git("diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", "src/migrations").split("\n").filter(Boolean);
} catch {
  // the base isn't in this clone (e.g. first push of a branch): check the last commit only
  changed = git("diff", "--name-only", "--diff-filter=AM", "HEAD~1", "HEAD", "--", "src/migrations").split("\n").filter(Boolean);
}
const files = changed.filter((f) => /\.ts$/.test(f) && !f.endsWith("index.ts") && existsSync(f));

const DESTRUCTIVE = [
  /\b(DROP\s+(TABLE|COLUMN|SCHEMA|TYPE|VIEW|INDEX|CONSTRAINT|DEFAULT)|RENAME\s+(TO|COLUMN|CONSTRAINT)|TRUNCATE|DELETE\s+FROM)\b/i,
  // the old version's values or saves no longer fit
  /\bALTER\s+COLUMN\b[^;]*\b(SET\s+DATA\s+TYPE|TYPE\s+\w|SET\s+NOT\s+NULL)/i,
  // a new column the old version doesn't fill, that may not be empty
  /\bADD\s+COLUMN\b(?![^;]*\bDEFAULT\b)[^;]*\bNOT\s+NULL\b/i,
];
const LEGACY = /"public"\s*\./i;

let failed = false;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const up = src.slice(src.indexOf("export async function up"), src.includes("export async function down") ? src.indexOf("export async function down") : undefined);
  const allowed = /\/\/\s*allow-destructive:\s*\S/.test(src);
  up.split("\n").forEach((line, i) => {
    if (LEGACY.test(line)) {
      console.error(`✗ ${file}: up() line ${i + 1} touches the legacy "public" schema (frozen Prisma tables): ${line.trim()}`);
      failed = true;
    } else if (DESTRUCTIVE.some((re) => re.test(line)) && !allowed) {
      console.error(`✗ ${file}: up() line ${i + 1} is destructive: ${line.trim()}`);
      failed = true;
    }
  });
}

if (failed) {
  console.error("\nMigrations run while the old version still serves the site – up() may only add what it can live with. If this change is really safe (and a backup was taken), add `// allow-destructive: <reason>` to the migration file.");
  process.exit(1);
}
console.log(files.length ? `✓ ${files.length} migration file(s) checked – additive only` : "✓ no migration changes");

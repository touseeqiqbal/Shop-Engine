#!/usr/bin/env node
/**
 * CI guard for Payload migrations added or changed since BASE (a git ref; default HEAD~1).
 *
 * The live site keeps running the old version while a new one builds, and `payload migrate` runs during the build –
 * so a migration's up() must only ADD things. Fails when a new/changed migration's up():
 *   - drops, renames or truncates something, or deletes rows   (allowed only with a line
 *     `// allow-destructive: <why it is safe>` in that file – after a backup, see docs)
 *   - touches the legacy Prisma tables in the "public" schema  (never allowed – they are frozen)
 *
 * usage: BASE=origin/master node scripts/ci/check-migrations.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const base = process.env.BASE || "HEAD~1";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

let changed;
try {
  changed = git("diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", "src/migrations").split("\n").filter(Boolean);
} catch {
  // the base isn't in this clone (e.g. first push of a branch): check the last commit only
  changed = git("diff", "--name-only", "--diff-filter=AM", "HEAD~1", "HEAD", "--", "src/migrations").split("\n").filter(Boolean);
}
const files = changed.filter((f) => /\.ts$/.test(f) && !f.endsWith("index.ts") && existsSync(f));

const DESTRUCTIVE = /\b(DROP\s+(TABLE|COLUMN|SCHEMA|TYPE|VIEW)|RENAME\s+(TO|COLUMN|CONSTRAINT)|TRUNCATE|DELETE\s+FROM)\b/i;
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
    } else if (DESTRUCTIVE.test(line) && !allowed) {
      console.error(`✗ ${file}: up() line ${i + 1} is destructive: ${line.trim()}`);
      failed = true;
    }
  });
}

if (failed) {
  console.error("\nMigrations run while the live site still uses the old version – up() may only add. If this change is really safe (and a backup was taken), add `// allow-destructive: <reason>` to the migration file.");
  process.exit(1);
}
console.log(files.length ? `✓ ${files.length} migration file(s) checked – additive only` : "✓ no migration changes");

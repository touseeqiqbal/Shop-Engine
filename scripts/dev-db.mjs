// Local PostgreSQL for development – no Docker or installer needed (real PostgreSQL binaries via embedded-postgres).
//
//   npm run db:local        # starts Postgres on 127.0.0.1:54329 (data in .data/postgres), keep this terminal open
//
// Then in another terminal (DATABASE_URL is read from .env):
//   npm run db:deploy && npm run db:seed      # legacy (Prisma) tables + sample data
//   npm run cms:migrate && npm run migrate:data
//   npm run dev
import fs from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const PORT = Number(process.env.LOCAL_PG_PORT || 54329);
const dir = path.resolve(".data/postgres");
const url = `postgresql://postgres:postgres@127.0.0.1:${PORT}/urko?sslmode=disable`;

const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: PORT, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
if (!fs.existsSync(path.join(dir, "PG_VERSION"))) {
  console.log("Initialising a new local database in .data/postgres …");
  await pg.initialise();
}
await pg.start();
await pg.createDatabase("urko").catch(() => {}); // already exists

// Make sure .env points at it (only adds DATABASE_URL if missing – never overwrites your values)
const envFile = path.resolve(".env");
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
if (!/^DATABASE_URL=/m.test(env)) {
  fs.appendFileSync(envFile, `${env && !env.endsWith("\n") ? "\n" : ""}# Local dev database (npm run db:local)\nDATABASE_URL=${url}\n`);
  console.log("Added DATABASE_URL to .env");
}

console.log(`\nLocal PostgreSQL is running → ${url}\nPress Ctrl+C to stop.\n`);
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);

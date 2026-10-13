// Bundles the maintenance tools into single self-contained files so they can be run with plain `node`
// inside the production container (Railway → service → Console). The image has no dev tools, TypeScript
// or source code – these bundles carry everything they need except native/AWS packages already in the image.
//
//   node scripts/build-console-tools.mjs      → dist/*.mjs   (the Dockerfile copies them to /app)
//
// In the Railway console (working directory /app):
//   node seed.mjs                         seed sample catalog / create first admin (SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD)
//   node migrate-data.mjs                 copy legacy data → Payload (+ applies pending Payload migrations), prints report
//   node migrate-data.mjs --since=<ISO>   cutover delta sync
//   node migrate-data.mjs --report-only   verify counts / totals / slugs only
//   node fingerprint-legacy.mjs > /tmp/before.json   (and --compare a.json b.json)
//   node smoke-test.mjs http://localhost:$PORT
import { build } from "esbuild";

const banner = { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" };
const common = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  banner,
  logLevel: "warning",
  conditions: ["react-server"],
  alias: { "server-only": "./scripts/migrate/empty.js", "next/cache": "./scripts/migrate/next-cache-stub.js" },
  external: ["sharp", "pg-native", "@aws-sdk/client-s3", "@aws-sdk/s3-presigned-post"],
  loader: { ".node": "copy" },
};

const tools = [
  ["prisma/seed.ts", "dist/seed.mjs"],
  ["scripts/migrate/prisma-to-payload.ts", "dist/migrate-data.mjs"],
  ["scripts/migrate/fingerprint-legacy.mjs", "dist/fingerprint-legacy.mjs"],
  ["scripts/smoke-test.mjs", "dist/smoke-test.mjs"],
];

for (const [entry, outfile] of tools) {
  await build({ ...common, entryPoints: [entry], outfile });
  console.log(`built ${outfile}`);
}

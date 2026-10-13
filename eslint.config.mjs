import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** `npm run lint` – Next.js recommended rules + TypeScript. Generated files are skipped. */
const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `_name` = deliberately unused (e.g. a field left out of an object copy)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      // `cond ? a() : b()` / `x && y()` as statements are used on purpose (event handlers)
      "@typescript-eslint/no-unused-expressions": ["warn", { allowShortCircuit: true, allowTernary: true }],
      // Loading data in an effect and storing it in state is the intended pattern in these client components.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // The /cms admin is Payload's own app: plain links and full-page navigation between admin screens are intended,
    // and thumbnails come straight from Payload's media sizes.
    files: ["src/payload/admin/**"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  {
    ignores: [".next/**", "dist/**", "node_modules/**", "src/generated/**", "src/payload-types.ts", "src/migrations/**", "src/app/(payload)/cms/importMap.js", "next-env.d.ts", ".tmp-test/**"],
  },
];

export default config;

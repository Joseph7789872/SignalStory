import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// Flat config (ESLint 9). `next lint` was removed in Next 16 — `npm run lint`
// runs `eslint .` against this. eslint-config-next@16 ships native flat
// configs, imported directly (no FlatCompat).
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/*.js", // local QA junk, gitignored
      "public/**",
      ".claude/**", // bundled agent-skill scripts, not app code
      ".playwright-mcp/**",
    ],
  },
  {
    // Established codebase patterns downgraded to warnings so lint gates on
    // real errors: `any` is deliberate in the webhook parsers and the
    // Zod→JSON-schema converter; the mounted-state effect pattern is used by
    // most client components.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
];

export default eslintConfig;

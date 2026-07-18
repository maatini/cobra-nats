import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Avoid eslint-plugin-react calling getFilename() during version detect (ESLint 9/10 edge cases).
    settings: {
      react: {
        version: "19.0",
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / local artifacts (must not be linted)
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "tmp/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;

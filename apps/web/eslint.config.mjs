import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // The app fetches data in effects (useEffect + useState) across ~10
      // routes. The React Compiler-era rule is useful but flags every one of
      // those patterns; keep it visible as a warning until the data layer is
      // migrated to a query library (tracked as an enterprise follow-up).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;

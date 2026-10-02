import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    // Existing effects intentionally restore local checkout and product state.
    // Migrate these individually after the React upgrade is verified.
    rules: { 'react-hooks/set-state-in-effect': 'off' }
  },
  globalIgnores(['.next/**', '.next-build/**', 'out/**', 'dist/**', 'coverage/**', 'next-env.d.ts'])
]);

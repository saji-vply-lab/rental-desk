import tseslint from "typescript-eslint";
export default [
  ...tseslint.configs.recommended,
  { ignores: ["**/dist/**", "test-results/**", "node_modules/**"] },
];

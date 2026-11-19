import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
const key = process.env.TENANT_KEY || "demo-shop";
if (!/^[a-z0-9-]+$/.test(key)) throw Error("Invalid tenant key");
const brand = JSON.parse(
  readFileSync(
    new URL("../../tenants/" + key + "/brand.json", import.meta.url),
    "utf8",
  ),
);
const tenantTheme = new URL(
  "../../tenants/" + key + "/theme.css",
  import.meta.url,
);
export default defineConfig({
  resolve: {
    alias: {
      "@tenant/theme.css": fileURLToPath(
        existsSync(tenantTheme)
          ? tenantTheme
          : new URL("./src/default-theme.css", import.meta.url),
      ),
    },
  },
  plugins: [tailwindcss()],
  define: { __BRAND__: JSON.stringify(brand) },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts:
      process.env.CODESPACE_NAME &&
      process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
        ? [
            process.env.CODESPACE_NAME +
              "-5173." +
              process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN,
          ]
        : [],
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});

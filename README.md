# RentalDesk

A local rental counter for one shop. Milestone 1 provides a read-only stock overview backed by SQLite. The demo shop and inventory are fictional.

## Run on your phone with Codespaces

1. Sign in to GitHub, open this repository and select **Code → Codespaces → Create codespace on main** (or resume your existing Codespace).
2. Wait for the dev container to install dependencies. In its terminal run `pnpm dev`.
3. In **Ports**, select port **5173**, verify visibility is **Private**, then tap **Open in Browser**. Sign in with the same GitHub account. Keep the API port unforwarded.
4. Stop the dev processes with Ctrl+C. At https://github.com/codespaces open the Codespace’s **… → Stop codespace** to stop compute usage.

## Local development

Use Node 24 and pnpm 10.32.1. Run `pnpm install --frozen-lockfile`, then `pnpm dev` and open http://localhost:5173. The server migrates SQLite and seeds fictional stock on first use. Run `pnpm check`, `pnpm test`, and `pnpm build`. For browser checks run `pnpm exec playwright install chromium` and `pnpm e2e`.

The default development database is data/development.sqlite relative to the repository root. Set DATABASE_PATH to an absolute path for a separate database. Build with TENANT_KEY set to a directory name under tenants (default demo-shop). The selected brand is bundled locally.

## Local installation direction

After building, run `pnpm start` to serve the bundled dashboard and API together at http://127.0.0.1:3001. Production uses a separate data/shop.sqlite and starts with empty stock. Package Node, dependencies, built assets and migrations for offline Windows/Linux deployment. LAN exposure, authentication, startup service and backups are future milestones. Use fictional data for this milestone.

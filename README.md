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

## Inventory management

Open **Manage inventory** on the dashboard. Search or scan an item ID and press Enter to open it. The catalog links to category management, item creation, pricing and location edits, stock adjustments and movement history. Prices are entered in rupees. Stock adjustments record the quantity, reason, operator and resulting balance.

The fictional development preview allows edits as Demo owner. For local production writes, configure RENTALDESK_OWNER_KEY or RENTALDESK_INVENTORY_STAFF_KEY on the server and enter the corresponding key on the form. These are interim inventory permissions pending named account management. Keep production credentials outside Git.

### Tenant appearance

Place an optional `theme.css` next to the selected tenant’s `brand.json`. The demo theme sets the accent, paper and ink colors, display font and locally bundled background photograph. Reference tenant images with relative CSS URLs. The dashboard uses the wide banner and management pages use the compact banner. A tenant without a stylesheet uses the shared theme and its configured accent.

## Billing and payments

Rental estimates use inclusive calendar dates and the agreed item rate. Fixed periods round up to whole periods for each quantity batch. Returned units stop accruing on their return date. Outstanding issued units are projected to the later of today and their expected return. The starting late fee is ₹0; an owner can record a per-unit daily fee and grace period for an open rental with a reason.

Open a rental and expand **Payments and billing adjustments** to record an advance, partial payment, refund, delivery or pickup charge, damage or loss charge, discount, or negotiated reduction. Percentage discounts use the base rental charge at the time the discount is recorded. Historical entries can be reversed with a reason. **Finalize bill** becomes available after all stock is returned and freezes the charges. Payments and refunds continue against that final total. Dashboard collections use payment dates and are net of refunds and corrections. Financial actions require owner access outside the fictional demo.

# SRS v1.3 implementation baseline

One independent installation serves one shop. Keep editable shop details in SQLite and package only the selected shop’s static branding. Business tables have no tenant identifier. English UI, INR and DD/MM/YYYY dates apply. Production must work offline over shop Wi-Fi.

1. **Foundation.** React/Vite dashboard, Fastify API, SQLite migrations, fictional seed, private cloud preview and automated checks.
2. **Counter and access.** Owner/staff login, configurable permissions and auditing. Searchable, pageable customers and inventory with item-level IDs, scanner input, zones, pricing and auditable stock adjustments.
3. **Bookings and issues.** Inquiry, explicit reservation, draft, booking and issue. Inherit common dates with independent per-line overrides. Offer optional line checks and atomically validate all dated quantities on commitment. Exclude rentals, reservations, unusable and retired stock. Unreserved inquiries protect no stock. Flag dependencies on expected returns in Critical Returns.
4. **Settlement.** Preserve agreed prices, extension history, partial-return batches, damage/loss, late penalties, discounts, transport and immutable payment corrections. Provide offline print/PDF and device sharing from saved transaction snapshots.
5. **Operations.** Daily/monthly reporting, permissions, daily consistent backups with 30-day retention, manual export/restore, offline laptop installation and mobile counter acceptance tests.

Owner decisions before the affected workflows ship include billing boundaries, grace periods and partial-return rates, permission matrix, inactive reserved items, customer address at quick entry, default page sizes, overrides and WhatsApp delivery. Branding and receipt footer use placeholders. PDF engine, backup scheduling and optional camera scanning remain open.

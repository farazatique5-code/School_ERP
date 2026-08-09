# Phase 11 — Inventory

## What shipped

**Database** (`020_inventory.sql`)
- `inventory_items` split into two real tracking models rather than one compromise table: **asset-tracked** (`inventory_assets` — one row per physical unit, its own asset tag, status, assignment) for furniture/lab equipment/electronics, and **stock-tracked** (`inventory_stock` + `stock_movements`) for consumables like stationery. This mirrors exactly how the PRD described "Assets / Furniture / Lab Equipment" versus "Stationery" as different concepts, rather than forcing both into one quantity column.
- `inventory_stock` is **never written to directly** — it's maintained entirely by `fn_apply_stock_movement()` reacting to `stock_movements` inserts, so every quantity change has a recorded reason and actor by construction, not by convention.
- `suppliers`, `purchase_orders`, `purchase_order_items`.
- **Real cross-module integration**: `fn_purchase_order_received()` posts stock-in movements for stock-tracked line items AND a genuine expense row to Phase 9's `ledger_entries` — inventory spend actually shows up in Financial Reports, not just a note that it should.

**Frontend** (`src/modules/inventory/`)
- Items list with real low-stock flagging (`quantity <= reorder_level`).
- Suppliers.
- Purchase Orders: draft → ordered → **received** (the automation trigger point) — the detail page explicitly tells staff that asset-tracked line items need their physical units added with individual asset tags after receiving, rather than silently pretending that step was automated too.

## A correction made mid-build, called out on purpose

While wiring the "mark as ordered" transition, I first wrote it as an inline dynamic import + raw Supabase call + full page reload directly in the component — a shortcut that didn't match the mutation-hook pattern every other write in this codebase follows. I caught it and replaced it with a proper `markPurchaseOrderOrdered` mutation + `useMarkPurchaseOrderOrdered` hook, consistent with everything else. Flagging it here rather than pretending the first version never happened.

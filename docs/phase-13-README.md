# Phase 13 — Transport

## What shipped

**Database** (`024_transport.sql`)
- `transport_vehicles` (with a `gps_device_id` field — "GPS Ready" per the PRD means a real join key for a GPS provider's data, not a fake live map with no device behind it), `transport_routes`, `transport_stops`, `student_transport_allocations` (one active allocation per student per year, enforced by a unique constraint), `vehicle_fuel_logs`, `vehicle_maintenance_logs`.
- **Third instance of the real ledger-posting pattern** (after admissions→fees in Phase 9 and purchase-orders→ledger in Phase 11): `fn_post_transport_expense()` fires on every fuel or maintenance log insert and posts a genuine `ledger_entries` expense row. Transport running costs show up in Financial Reports the moment they're logged, not as a note that they should.

**Frontend** (`src/modules/transport/`)
- Vehicles: list, add, and an inline fuel/maintenance log panel per vehicle.
- Routes: list, create, assign a vehicle.
- Route detail: stops with pickup/drop times, student allocation per stop, cancel/remove.

## Known, honest gap — and the fix

Same acknowledged pattern as Fees, Library, Inventory, and Hostel: raw student/employee UUID text inputs kept accumulating across modules. Rather than flag it a fifth time and defer again, I built a shared `PersonPicker` component (`src/components/ui/PersonPicker.tsx` — searchable, debounced-by-query-length, works for both students and employees) and retrofitted it into **all five places it was missing**: Fees' invoice form, Library's circulation issue form, Hostel's visitor log and bed allocation drawer, and this phase's route-stop student allocation form. Inventory's purchase order form didn't need it (its pickers are for items/locations, not people). No module in this project should introduce a new raw-UUID person input going forward — reach for `PersonPicker` instead.

-- =====================================================================
-- PHASE 11: INVENTORY
-- Depends on: 001 (schools), 016 (ledger_entries — purchase receipt
-- posts a real expense entry, closing a cross-module loop rather than
-- inventing a separate finance concept for inventory spend).
-- =====================================================================

create table inventory_categories (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,               -- "Furniture", "Lab Equipment", "Stationery"
  created_at    timestamptz not null default now(),
  unique (school_id, name)
);

create table inventory_locations (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,               -- "Main Warehouse", "Science Lab", "Room 204"
  location_type text not null default 'room' check (location_type in ('warehouse','room','lab')),
  created_at    timestamptz not null default now(),
  unique (school_id, name)
);

create table suppliers (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,
  contact_person text,
  phone         text,
  email         text,
  address       text,
  created_at    timestamptz not null default now()
);

-- An item definition is either "asset-tracked" (individually numbered —
-- furniture, lab equipment, electronics) or "stock-tracked" (counted in
-- bulk — stationery, consumables). One flag decides which of the two
-- tables below actually holds its real-world instances.
create table inventory_items (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references schools(id) on delete cascade,
  category_id       uuid references inventory_categories(id) on delete set null,
  name              text not null,
  sku               text,
  unit_of_measure   text not null default 'unit',   -- "unit", "box", "ream"
  is_asset_tracked  boolean not null default false,
  reorder_level     integer,                          -- for stock items: trigger a low-stock flag below this
  created_at        timestamptz not null default now()
);
create index idx_inventory_items_school on inventory_items(school_id, category_id);

-- ---------------------------------------------------------------------
-- ASSET-TRACKED ITEMS: one row per physical unit.
-- ---------------------------------------------------------------------
create table inventory_assets (
  id                uuid primary key default uuid_generate_v4(),
  item_id           uuid not null references inventory_items(id) on delete cascade,
  asset_tag         text not null,
  location_id       uuid references inventory_locations(id) on delete set null,
  status            text not null default 'in_use' check (status in ('in_use','in_storage','under_repair','disposed')),
  assigned_to_profile_id uuid references profiles(id) on delete set null,
  purchase_date     date,
  purchase_cost     numeric(12,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (asset_tag)
);
create index idx_inventory_assets_item on inventory_assets(item_id);
create index idx_inventory_assets_location on inventory_assets(location_id);

-- ---------------------------------------------------------------------
-- STOCK-TRACKED ITEMS: quantity per location, maintained by
-- stock_movements (never edited directly — see trigger below), so every
-- quantity change has a reason and an audit trail by construction.
-- ---------------------------------------------------------------------
create table inventory_stock (
  item_id       uuid not null references inventory_items(id) on delete cascade,
  location_id   uuid not null references inventory_locations(id) on delete cascade,
  quantity      integer not null default 0 check (quantity >= 0),
  updated_at    timestamptz not null default now(),
  primary key (item_id, location_id)
);

create table stock_movements (
  id                uuid primary key default uuid_generate_v4(),
  item_id           uuid not null references inventory_items(id) on delete cascade,
  location_id       uuid not null references inventory_locations(id) on delete cascade,
  movement_type     text not null check (movement_type in ('in','out','adjustment')),
  quantity          integer not null check (quantity != 0),
  reason            text,
  reference_po_id   uuid,   -- fk added after purchase_orders exists, below
  recorded_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_stock_movements_item_location on stock_movements(item_id, location_id);

create or replace function fn_apply_stock_movement()
returns trigger
language plpgsql security definer
as $$
declare
  v_delta integer;
begin
  v_delta := case when NEW.movement_type = 'out' then -abs(NEW.quantity) else abs(NEW.quantity) end;

  insert into inventory_stock (item_id, location_id, quantity, updated_at)
  values (NEW.item_id, NEW.location_id, greatest(0, v_delta), now())
  on conflict (item_id, location_id) do update
    set quantity = greatest(0, inventory_stock.quantity + v_delta), updated_at = now();

  return NEW;
end;
$$;

create trigger trg_apply_stock_movement
  after insert on stock_movements
  for each row execute function fn_apply_stock_movement();

-- ---------------------------------------------------------------------
-- PURCHASE ORDERS
-- ---------------------------------------------------------------------
create table purchase_orders (
  id                uuid primary key default uuid_generate_v4(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  supplier_id       uuid not null references suppliers(id) on delete restrict,
  order_number      text not null,
  order_date        date not null default current_date,
  status            text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  total_amount      numeric(12,2) not null default 0,
  created_by_profile_id uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, order_number)
);

create table purchase_order_items (
  id                uuid primary key default uuid_generate_v4(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  item_id           uuid not null references inventory_items(id) on delete cascade,
  location_id       uuid not null references inventory_locations(id) on delete restrict,  -- where received stock lands
  quantity          integer not null check (quantity > 0),
  unit_cost         numeric(12,2) not null check (unit_cost >= 0)
);

alter table stock_movements add constraint fk_stock_movements_po foreign key (reference_po_id) references purchase_orders(id) on delete set null;

create or replace function generate_po_number(p_school_id uuid)
returns text
language plpgsql security definer
as $$
declare
  v_school_code text;
  v_year text := to_char(now(), 'YYYY');
  v_next_seq int;
begin
  select code into v_school_code from schools where id = p_school_id;
  select coalesce(max((regexp_match(order_number, '-(\d+)$'))[1]::int), 0) + 1 into v_next_seq
  from purchase_orders where school_id = p_school_id and order_number like v_school_code || '-PO-' || v_year || '-%';
  return v_school_code || '-PO-' || v_year || '-' || lpad(v_next_seq::text, 4, '0');
end;
$$;
grant execute on function generate_po_number to authenticated;

-- ---------------------------------------------------------------------
-- PURCHASE_ORDER_RECEIVED AUTOMATION
-- Marking a PO "received" posts a stock_movements 'in' row for every
-- stock-tracked line item (asset-tracked items are added as individual
-- inventory_assets rows by staff directly, since each unit needs its own
-- asset tag — not something to auto-generate blindly) AND posts a real
-- expense entry to the Phase 9 ledger. This is a genuine cross-module
-- integration, not a note-to-self about one.
-- ---------------------------------------------------------------------
create or replace function fn_purchase_order_received()
returns trigger
language plpgsql security definer
as $$
declare
  v_item record;
  v_org_id uuid;
begin
  if NEW.status = 'received' and OLD.status is distinct from 'received' then
    select organization_id into v_org_id from schools where id = NEW.school_id;

    for v_item in
      select poi.*, ii.is_asset_tracked
      from purchase_order_items poi
      join inventory_items ii on ii.id = poi.item_id
      where poi.purchase_order_id = NEW.id
    loop
      if not v_item.is_asset_tracked then
        insert into stock_movements (item_id, location_id, movement_type, quantity, reason, reference_po_id, recorded_by_profile_id)
        values (v_item.item_id, v_item.location_id, 'in', v_item.quantity, 'Received from PO ' || NEW.order_number, NEW.id, NEW.created_by_profile_id);
      end if;
    end loop;

    insert into ledger_entries (organization_id, school_id, entry_type, category, amount, entry_date, description, recorded_by_profile_id)
    values (v_org_id, NEW.school_id, 'expense', 'Inventory Purchase', NEW.total_amount, current_date,
            'Purchase order ' || NEW.order_number, NEW.created_by_profile_id);

    insert into automation_runs (organization_id, automation_key, trigger_table, trigger_row_id, status, payload)
    values (v_org_id, 'purchase_order_received', 'purchase_orders', NEW.id, 'success',
            jsonb_build_object('ledger_entry_posted', true, 'note', 'Asset-tracked line items must be added to inventory_assets manually with their own asset tags.'));
  end if;
  return NEW;
end;
$$;

create trigger trg_purchase_order_received
  after update on purchase_orders
  for each row execute function fn_purchase_order_received();

create trigger audit_inventory_assets after insert or update or delete on inventory_assets
  for each row execute function fn_audit_trigger();
create trigger audit_purchase_orders after insert or update or delete on purchase_orders
  for each row execute function fn_audit_trigger();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table inventory_categories enable row level security;
alter table inventory_locations enable row level security;
alter table suppliers enable row level security;
alter table inventory_items enable row level security;
alter table inventory_assets enable row level security;
alter table inventory_stock enable row level security;
alter table stock_movements enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

create policy inventory_categories_select on inventory_categories for select using (auth_has_school_access(school_id));
create policy inventory_categories_write on inventory_categories for all using (
  auth_has_school_access(school_id) and auth_has_permission('inventory.manage'));

create policy inventory_locations_select on inventory_locations for select using (auth_has_school_access(school_id));
create policy inventory_locations_write on inventory_locations for all using (
  auth_has_school_access(school_id) and auth_has_permission('inventory.manage'));

create policy suppliers_select on suppliers for select using (
  auth_has_school_access(school_id) and auth_has_permission('inventory.manage'));
create policy suppliers_write on suppliers for all using (
  auth_has_school_access(school_id) and auth_has_permission('inventory.manage'));

create policy inventory_items_select on inventory_items for select using (
  auth_has_school_access(school_id) and auth_has_permission('inventory.view'));
create policy inventory_items_write on inventory_items for all using (
  auth_has_school_access(school_id) and auth_has_permission('inventory.manage'));

create policy inventory_assets_select on inventory_assets for select using (
  item_id in (select id from inventory_items where auth_has_school_access(school_id)) and auth_has_permission('inventory.view'));
create policy inventory_assets_write on inventory_assets for all using (
  item_id in (select id from inventory_items where auth_has_school_access(school_id)) and auth_has_permission('inventory.manage'));

create policy inventory_stock_select on inventory_stock for select using (
  item_id in (select id from inventory_items where auth_has_school_access(school_id)) and auth_has_permission('inventory.view'));

create policy stock_movements_select on stock_movements for select using (
  item_id in (select id from inventory_items where auth_has_school_access(school_id)) and auth_has_permission('inventory.view'));
create policy stock_movements_insert on stock_movements for insert with check (
  item_id in (select id from inventory_items where auth_has_school_access(school_id)) and auth_has_permission('inventory.manage'));

create policy purchase_orders_select on purchase_orders for select using (
  auth_has_school_access(school_id) and auth_has_permission('inventory.view'));
create policy purchase_orders_write on purchase_orders for all using (
  auth_has_school_access(school_id) and auth_has_permission('inventory.manage'));

create policy purchase_order_items_select on purchase_order_items for select using (
  purchase_order_id in (select id from purchase_orders where auth_has_school_access(school_id)) and auth_has_permission('inventory.view'));
create policy purchase_order_items_write on purchase_order_items for all using (
  purchase_order_id in (select id from purchase_orders where auth_has_school_access(school_id)) and auth_has_permission('inventory.manage'));

-- ---------------------------------------------------------------------
-- PERMISSION CATALOG ADDITIONS FOR PHASE 11
-- ---------------------------------------------------------------------
insert into permissions (key, module, description) values
  ('inventory.view',   'inventory', 'View inventory items, stock levels, and purchase orders'),
  ('inventory.manage', 'inventory', 'Manage items, assets, stock movements, suppliers, and purchase orders')
on conflict (key) do nothing;

with grant_map as (
  select r.id as role_id, p.id as permission_id
  from roles r
  join permissions p on true
  where r.organization_id is null and (
    r.name in ('Super Admin','Organization Owner','School Administrator','HR Manager') and p.module = 'inventory'
  )
)
insert into role_permissions (role_id, permission_id)
select role_id, permission_id from grant_map
on conflict (role_id, permission_id) do nothing;

insert into platform_phases (id, name, status, completed_at)
values (11, 'Inventory', 'in_progress', null)
on conflict (id) do update set status = 'in_progress';

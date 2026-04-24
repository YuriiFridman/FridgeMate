-- Fridge Mate base schema
-- Run this in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

create table if not exists public.households (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) > 1),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default uuid_generate_v4(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) > 0),
  category text not null check (
    category in (
      'Dairy',
      'Meat',
      'Vegetables',
      'Fruits',
      'Bakery',
      'Frozen',
      'Pantry',
      'Beverages',
      'Other'
    )
  ),
  expiry_date date not null,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'fresh' check (status in ('fresh', 'expiring_soon', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_household_id on public.profiles(household_id);
create index if not exists idx_inventory_household_id on public.inventory(household_id);
create index if not exists idx_inventory_expiry_date on public.inventory(expiry_date);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

drop trigger if exists set_inventory_updated_at on public.inventory;
create trigger set_inventory_updated_at
before update on public.inventory
for each row execute function public.update_updated_at_column();

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.inventory enable row level security;

drop policy if exists "Households are readable by members" on public.households;
create policy "Households are readable by members"
on public.households
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.household_id = households.id
  )
);

drop policy if exists "Users can create households" on public.households;
create policy "Users can create households"
on public.households
for insert
with check (created_by = auth.uid());

drop policy if exists "Profiles are viewable in same household" on public.profiles;
create policy "Profiles are viewable in same household"
on public.profiles
for select
using (
  id = auth.uid()
  or household_id in (
    select household_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Inventory readable by household members" on public.inventory;
create policy "Inventory readable by household members"
on public.inventory
for select
using (
  household_id in (
    select household_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Inventory insert by household members" on public.inventory;
create policy "Inventory insert by household members"
on public.inventory
for insert
with check (
  created_by = auth.uid()
  and household_id in (
    select household_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Inventory update by household members" on public.inventory;
create policy "Inventory update by household members"
on public.inventory
for update
using (
  household_id in (
    select household_id
    from public.profiles
    where id = auth.uid()
  )
)
with check (
  household_id in (
    select household_id
    from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Inventory delete by household members" on public.inventory;
create policy "Inventory delete by household members"
on public.inventory
for delete
using (
  household_id in (
    select household_id
    from public.profiles
    where id = auth.uid()
  )
);

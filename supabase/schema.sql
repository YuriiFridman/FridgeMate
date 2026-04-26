-- Fridge Mate base schema (clean bootstrap)
-- Run this file from top to bottom in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

-- Core entities
create table if not exists public.households (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) > 1),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  role text not null default 'Member' check (role in ('Owner', 'Admin', 'Member')),
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

create table if not exists public.shopping_items (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) > 0),
  is_bought boolean not null default false,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Growth / smart modules
create table if not exists public.profile_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  diet text,
  allergies text[] not null default '{}',
  excluded_ingredients text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_checklists (
  family_id uuid primary key references public.households(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_profiles_household_id on public.profiles(household_id);
create index if not exists idx_inventory_household_id on public.inventory(household_id);
create index if not exists idx_inventory_expiry_date on public.inventory(expiry_date);
create index if not exists idx_shopping_family_id on public.shopping_items(family_id);
create index if not exists idx_profile_preferences_user_id on public.profile_preferences(user_id);

-- Helpers
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_household_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

-- Triggers
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

drop trigger if exists set_inventory_updated_at on public.inventory;
create trigger set_inventory_updated_at
before update on public.inventory
for each row execute function public.update_updated_at_column();

drop trigger if exists set_profile_preferences_updated_at on public.profile_preferences;
create trigger set_profile_preferences_updated_at
before update on public.profile_preferences
for each row execute function public.update_updated_at_column();

-- RLS
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.inventory enable row level security;
alter table public.shopping_items enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.event_checklists enable row level security;

-- Households policies
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

drop policy if exists "Household owner can delete household" on public.households;
create policy "Household owner can delete household"
on public.households
for delete
using (created_by = auth.uid());

-- Profiles policies
drop policy if exists "Profiles are viewable in same household" on public.profiles;
create policy "Profiles are viewable in same household"
on public.profiles
for select
using (
  id = auth.uid()
  or household_id = public.current_user_household_id()
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

-- Inventory policies
drop policy if exists "Inventory readable by household members" on public.inventory;
create policy "Inventory readable by household members"
on public.inventory
for select
using (household_id = public.current_user_household_id());

drop policy if exists "Inventory insert by household members" on public.inventory;
create policy "Inventory insert by household members"
on public.inventory
for insert
with check (
  created_by = auth.uid()
  and household_id = public.current_user_household_id()
);

drop policy if exists "Inventory update by household members" on public.inventory;
create policy "Inventory update by household members"
on public.inventory
for update
using (household_id = public.current_user_household_id())
with check (household_id = public.current_user_household_id());

drop policy if exists "Inventory delete by household members" on public.inventory;
create policy "Inventory delete by household members"
on public.inventory
for delete
using (household_id = public.current_user_household_id());

-- Shopping policies
drop policy if exists "Shopping readable by household members" on public.shopping_items;
create policy "Shopping readable by household members"
on public.shopping_items
for select
using (family_id = public.current_user_household_id());

drop policy if exists "Shopping insert by household members" on public.shopping_items;
create policy "Shopping insert by household members"
on public.shopping_items
for insert
with check (family_id = public.current_user_household_id());

drop policy if exists "Shopping update by household members" on public.shopping_items;
create policy "Shopping update by household members"
on public.shopping_items
for update
using (family_id = public.current_user_household_id())
with check (family_id = public.current_user_household_id());

drop policy if exists "Shopping delete by household members" on public.shopping_items;
create policy "Shopping delete by household members"
on public.shopping_items
for delete
using (family_id = public.current_user_household_id());

-- Preferences policies
drop policy if exists "Preferences readable by owner" on public.profile_preferences;
create policy "Preferences readable by owner"
on public.profile_preferences
for select
using (user_id = auth.uid());

drop policy if exists "Preferences insert by owner" on public.profile_preferences;
create policy "Preferences insert by owner"
on public.profile_preferences
for insert
with check (user_id = auth.uid());

drop policy if exists "Preferences update by owner" on public.profile_preferences;
create policy "Preferences update by owner"
on public.profile_preferences
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Event checklist policies
drop policy if exists "Event checklists readable by household members" on public.event_checklists;
create policy "Event checklists readable by household members"
on public.event_checklists
for select
using (family_id = public.current_user_household_id());

drop policy if exists "Event checklists writable by household members" on public.event_checklists;
create policy "Event checklists writable by household members"
on public.event_checklists
for insert
with check (family_id = public.current_user_household_id());

drop policy if exists "Event checklists update by household members" on public.event_checklists;
create policy "Event checklists update by household members"
on public.event_checklists
for update
using (family_id = public.current_user_household_id())
with check (family_id = public.current_user_household_id());

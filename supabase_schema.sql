-- =========================================================================
-- NETFLEX Cloud Database Schema for Supabase
-- Copy and run this script in your Supabase Project's "SQL Editor"
-- =========================================================================

-- 1. Create Watchlist Table (片单表)
create table if not exists public.netflex_watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  profile_id text not null,
  item_id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  constraint netflex_watchlist_user_profile_item_unique unique(user_id, profile_id, item_id)
);

-- 2. Create Watch History Table (观影历史与秒级播放进度表)
create table if not exists public.netflex_watch_history (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  profile_id text not null,
  item_id text not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  constraint netflex_watch_history_user_profile_item_unique unique(user_id, profile_id, item_id)
);

-- 3. Create Custom Accounts Table (for non-email auth or fallback)
create table if not exists public.netflex_accounts (
  id text primary key,
  email text unique not null,
  username text not null,
  password_hash text not null,
  profiles jsonb not null default '[]'::jsonb,
  current_profile_id text not null,
  created_at timestamptz default now()
);

-- 4. Enable Row Level Security (RLS)
alter table public.netflex_watchlist enable row level security;
alter table public.netflex_watch_history enable row level security;
alter table public.netflex_accounts enable row level security;

-- 5. Open Public Access Policies (Allows seamless client app access)
create policy "Allow all public on watchlist" on public.netflex_watchlist for all using (true) with check (true);
create policy "Allow all public on watch history" on public.netflex_watch_history for all using (true) with check (true);
create policy "Allow all public on accounts" on public.netflex_accounts for all using (true) with check (true);

-- 6. Create fast lookup indexes
create index if not exists idx_netflex_watchlist_lookup on public.netflex_watchlist (user_id, profile_id);
create index if not exists idx_netflex_history_lookup on public.netflex_watch_history (user_id, profile_id);

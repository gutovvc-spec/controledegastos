create table if not exists public.passkey_credentials (
  credential_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists passkey_credentials_user_id_idx
  on public.passkey_credentials (user_id);

alter table public.passkey_credentials enable row level security;
revoke all on public.passkey_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.passkey_credentials to service_role;

create table if not exists public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  flow text not null check (flow in ('registration', 'authentication')),
  user_id uuid references auth.users (id) on delete cascade,
  origin text not null,
  rp_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists passkey_challenges_created_at_idx
  on public.passkey_challenges (created_at);

alter table public.passkey_challenges enable row level security;
revoke all on public.passkey_challenges from public, anon, authenticated;
grant select, insert, delete on public.passkey_challenges to service_role;

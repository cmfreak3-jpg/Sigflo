create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists exchange_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  exchange text not null check (exchange in ('bybit', 'mexc')),
  encrypted_key text not null,
  encrypted_secret text not null,
  encrypted_passphrase text,
  status text not null check (status in ('connected', 'invalid')),
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exchange)
);

create table if not exists integration_audit_log (
  id bigserial primary key,
  user_id text not null references users(id) on delete cascade,
  exchange text not null check (exchange in ('bybit', 'mexc')),
  event_type text not null check (event_type in ('connect', 'disconnect', 'validate_fail')),
  detail text not null,
  created_at timestamptz not null default now()
);

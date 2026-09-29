-- Run this once in the Supabase SQL editor before deploying the backend.

create table if not exists public.screenshots (
  id text primary key,
  cloudinary_url text not null,
  cloudinary_public_id text not null,
  cloudinary_asset jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  source text not null default 'desktop-client',
  tags text[] not null default '{}',
  device_id text not null default 'unknown-device',
  timestamp timestamptz not null,
  label text not null default 'screenshot',
  filename text not null,
  size_bytes bigint not null default 0,
  mimetype text,
  received_at timestamptz not null default now(),
  dashboard_since timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'active' and archived_at is null) or
    (status = 'archived' and archived_at is not null)
  )
);

create index if not exists screenshots_status_received_at_idx
  on public.screenshots (status, received_at desc);
create index if not exists screenshots_source_idx on public.screenshots (source);
create index if not exists screenshots_tags_idx on public.screenshots using gin (tags);

create table if not exists public.snippets (
  id text primary key,
  shortcut text not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shortcut)
);

create table if not exists public.app_config (
  id boolean primary key default true check (id),
  screenshot_hotkey text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (id, screenshot_hotkey)
values (true, 'Win+Alt+C')
on conflict (id) do nothing;

create table if not exists public.clipboard_history (
  id text primary key,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists clipboard_history_created_at_idx
  on public.clipboard_history (created_at desc);

create extension if not exists pgcrypto;

create table if not exists public.admin_settings (
  id boolean primary key default true check (id),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

-- Set the initial admin password. The only valid username is always "admin".
-- Replace the quoted value before running this statement.
insert into public.admin_settings (id, password_hash, updated_at)
values (true, crypt('replace-with-a-strong-password', gen_salt('bf')), now())
on conflict (id) do update
set password_hash = excluded.password_hash, updated_at = excluded.updated_at;

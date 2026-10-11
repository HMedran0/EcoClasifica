-- EcoClasifica — migración inicial
-- No modificar este archivo: los cambios van en migraciones nuevas (0002_..., 0003_...).

create extension if not exists pgcrypto;

-- ───────────────────────── Tablas ─────────────────────────

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  daily_scan_quota int not null default 60,
  created_at timestamptz not null default now()
);

create table materials (
  code text primary key,             -- plastico, papel, vidrio, ...
  name_es text not null,
  icon text
);

create table disposal_rules (
  id uuid primary key default gen_random_uuid(),
  material_code text not null references materials(code),
  municipality_code text not null default 'DEFAULT',
  bin_code text not null check (bin_code in ('WHITE', 'BLACK', 'GREEN', 'DROP_OFF', 'BULKY')),
  bin_name text not null,
  color_hex text not null,
  icon text,
  instructions text,
  requires_drop_off boolean not null default false,
  unique (material_code, municipality_code)
);

create type scan_mode as enum ('classify', 'upcycle');

create table scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  mode scan_mode not null,
  object_name text not null,
  material_code text references materials(code),
  material_detail text,
  confidence numeric(3,2) check (confidence between 0 and 1),
  difficulty text check (difficulty in ('Fácil', 'Medio', 'Difícil')),
  image_path text,
  user_feedback text,
  created_at timestamptz not null default now()
);

create table scan_ideas (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  idea_index smallint not null check (idea_index between 0 and 2),
  title text not null,
  description text not null,
  extra_materials jsonb not null default '[]',
  unique (scan_id, idea_index)
);

-- Favoritos con copia (snapshot): borrar el historial no borra los favoritos.
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  idea_id uuid references scan_ideas(id) on delete set null,
  object_name text not null,
  difficulty text check (difficulty in ('Fácil', 'Medio', 'Difícil')),
  title text not null,
  description text not null,
  extra_materials jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, idea_id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  idea_id uuid not null references scan_ideas(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  scan_id uuid references scans(id) on delete set null,
  endpoint text not null,
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Índices ─────────────────────────

create index scans_user_created_idx on scans (user_id, created_at desc);
create index scan_ideas_scan_idx on scan_ideas (scan_id);
create index favorites_user_created_idx on favorites (user_id, created_at desc);
create index chat_messages_idea_created_idx on chat_messages (idea_id, created_at);
create index ai_usage_user_created_idx on ai_usage (user_id, created_at);

-- ───────────────── Perfil automático al registrarse ─────────────────

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── RLS ─────────────────────────
-- Atención: el backend usa la service role key, que SALTA RLS.
-- Cada consulta del backend debe filtrar por el usuario autenticado.

alter table profiles enable row level security;
alter table materials enable row level security;
alter table disposal_rules enable row level security;
alter table scans enable row level security;
alter table scan_ideas enable row level security;
alter table favorites enable row level security;
alter table chat_messages enable row level security;
alter table ai_usage enable row level security;   -- sin políticas: solo el backend

create policy profiles_own on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy materials_read on materials for select using (true);
create policy disposal_rules_read on disposal_rules for select using (true);

create policy scans_own on scans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy scan_ideas_via_scan on scan_ideas
  for all
  using (exists (select 1 from scans s where s.id = scan_id and s.user_id = auth.uid()))
  with check (exists (select 1 from scans s where s.id = scan_id and s.user_id = auth.uid()));

create policy favorites_own on favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_messages_own on chat_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── Storage ─────────────────────────
-- Bucket privado; rutas <user_id>/<scan_id>.jpg

insert into storage.buckets (id, name, public)
values ('scan-images', 'scan-images', false)
on conflict (id) do nothing;

create policy scan_images_read_own on storage.objects
  for select using (
    bucket_id = 'scan-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy scan_images_delete_own on storage.objects
  for delete using (
    bucket_id = 'scan-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

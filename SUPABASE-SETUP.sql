-- Jalankan sekali di Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.catin_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'Baru',
  suami text, nik_suami text, istri text, nik_istri text,
  ttl_suami text, ttl_istri text, alamat text, whatsapp text,
  tanggal text, kua text, catatan text
);

alter table public.site_settings enable row level security;
alter table public.catin_submissions enable row level security;

drop policy if exists "public read portal data" on public.site_settings;
drop policy if exists "authenticated manage portal data" on public.site_settings;
create policy "public read portal data" on public.site_settings for select using (key = 'portal_data');
create policy "authenticated manage portal data" on public.site_settings for all to authenticated using (true) with check (true);

drop policy if exists "public submit catin" on public.catin_submissions;
drop policy if exists "authenticated read catin" on public.catin_submissions;
drop policy if exists "authenticated manage catin" on public.catin_submissions;
create policy "public submit catin" on public.catin_submissions for insert to anon, authenticated with check (true);
create policy "authenticated read catin" on public.catin_submissions for select to authenticated using (true);
create policy "authenticated manage catin" on public.catin_submissions for update, delete to authenticated using (true) with check (true);

insert into storage.buckets (id,name,public)
values ('website-files','website-files',true)
on conflict (id) do update set public=true;

drop policy if exists "public view website-files" on storage.objects;
drop policy if exists "authenticated upload website-files" on storage.objects;
drop policy if exists "authenticated delete website-files" on storage.objects;
create policy "public view website-files" on storage.objects
for select using (bucket_id='website-files');
create policy "authenticated upload website-files" on storage.objects
for insert to authenticated
with check (bucket_id='website-files');
create policy "authenticated delete website-files" on storage.objects
for delete to authenticated
using (bucket_id='website-files');

-- Galeri: metadata disimpan di content_items.
-- Jalankan hanya jika tabel content_items belum dibuat oleh schema Anda.
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('agenda','materi','laporan','galeri','arsip')),
  title text not null,
  excerpt text,
  content text,
  event_date date,
  participants integer default 0,
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  image_url text,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.content_items enable row level security;
drop policy if exists "public read content items" on public.content_items;
drop policy if exists "authenticated manage content items" on public.content_items;
create policy "public read content items" on public.content_items
for select using (true);
create policy "authenticated manage content items" on public.content_items
for all to authenticated using (true) with check (true);

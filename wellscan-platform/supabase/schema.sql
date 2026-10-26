-- WellScan isolated schema for reuse of an existing Supabase project.
-- Does not modify LYPE's public.profiles, public.scans, or public.ingredient_dictionary.
create extension if not exists pgcrypto;
create table if not exists public.wellscan_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text,
 role text not null default 'user' check (role in ('user','admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.wellscan_scans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 profile_id text not null check (profile_id in ('general','pregnant','diabetes','child','nutrition','allergy')),
 source_text text not null,
 source_language text,
 output_language text not null default 'ko' check (output_language in ('ko','en')),
 product_name text,
 status text not null default 'completed',
 result_json jsonb,
 created_at timestamptz not null default now()
);
create index if not exists wellscan_scans_user_created_idx on public.wellscan_scans(user_id, created_at desc);
create table if not exists public.wellscan_ingredient_dictionary (
 id uuid primary key default gen_random_uuid(),
 canonical_name_ko text not null,
 canonical_name_en text not null,
 aliases text[] not null default '{}',
 category text not null default 'general',
 review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists wellscan_ingredient_dictionary_ko_idx on public.wellscan_ingredient_dictionary(canonical_name_ko);
create index if not exists wellscan_ingredient_dictionary_en_idx on public.wellscan_ingredient_dictionary(canonical_name_en);
create or replace function public.wellscan_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.wellscan_profiles(id,email,role) values(new.id,new.email,'user')
 on conflict(id) do update set email=excluded.email;
 return new;
end; $$;
revoke all on function public.wellscan_handle_new_user() from public, anon, authenticated;
drop trigger if exists wellscan_on_auth_user_created on auth.users;
create trigger wellscan_on_auth_user_created after insert on auth.users
for each row execute procedure public.wellscan_handle_new_user();
create or replace function public.wellscan_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.wellscan_profiles p where p.id=(select auth.uid()) and p.role='admin');
$$;
revoke all on function public.wellscan_is_admin() from public, anon;
grant execute on function public.wellscan_is_admin() to authenticated;
alter table public.wellscan_profiles enable row level security;
alter table public.wellscan_scans enable row level security;
alter table public.wellscan_ingredient_dictionary enable row level security;
drop policy if exists wellscan_profile_read_self on public.wellscan_profiles;
create policy wellscan_profile_read_self on public.wellscan_profiles for select to authenticated using ((select auth.uid())=id);
drop policy if exists wellscan_profile_update_self on public.wellscan_profiles;
create policy wellscan_profile_update_self on public.wellscan_profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id and role='user');
drop policy if exists wellscan_profile_read_admin on public.wellscan_profiles;
create policy wellscan_profile_read_admin on public.wellscan_profiles for select to authenticated using (public.wellscan_is_admin());
drop policy if exists wellscan_scan_read_own on public.wellscan_scans;
create policy wellscan_scan_read_own on public.wellscan_scans for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists wellscan_scan_insert_own on public.wellscan_scans;
create policy wellscan_scan_insert_own on public.wellscan_scans for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists wellscan_scan_delete_own on public.wellscan_scans;
create policy wellscan_scan_delete_own on public.wellscan_scans for delete to authenticated using ((select auth.uid())=user_id);
drop policy if exists wellscan_scan_read_admin on public.wellscan_scans;
create policy wellscan_scan_read_admin on public.wellscan_scans for select to authenticated using (public.wellscan_is_admin());
drop policy if exists wellscan_dictionary_read_authenticated on public.wellscan_ingredient_dictionary;
create policy wellscan_dictionary_read_authenticated on public.wellscan_ingredient_dictionary for select to authenticated using (true);
drop policy if exists wellscan_dictionary_insert_admin on public.wellscan_ingredient_dictionary;
create policy wellscan_dictionary_insert_admin on public.wellscan_ingredient_dictionary for insert to authenticated with check (public.wellscan_is_admin());
drop policy if exists wellscan_dictionary_update_admin on public.wellscan_ingredient_dictionary;
create policy wellscan_dictionary_update_admin on public.wellscan_ingredient_dictionary for update to authenticated using (public.wellscan_is_admin()) with check (public.wellscan_is_admin());
drop policy if exists wellscan_dictionary_delete_admin on public.wellscan_ingredient_dictionary;
create policy wellscan_dictionary_delete_admin on public.wellscan_ingredient_dictionary for delete to authenticated using (public.wellscan_is_admin());
grant select, update on public.wellscan_profiles to authenticated;
grant select, insert, delete on public.wellscan_scans to authenticated;
grant select, insert, update, delete on public.wellscan_ingredient_dictionary to authenticated;
-- After creating an account, grant admin explicitly from SQL Editor:
-- update public.wellscan_profiles set role='admin' where email='your-admin@example.com';

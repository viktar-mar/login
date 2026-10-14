create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- RLS limits rows; column grants also protect identity and database timestamps.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    pg_catalog.left(
      coalesce(
        nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), '')
      ),
      100
    ),
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'picture'), '')
    )
  );
  return new;
end;
$$;

-- These are trigger entry points, never client-callable RPC endpoints.
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Unlike now(), this advances even for multiple updates in one transaction.
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function public.set_profile_updated_at() from public, anon, authenticated;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

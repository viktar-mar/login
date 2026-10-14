begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

-- These assertions catch missing keys, ownership links, or disabled RLS.
select has_table('public', 'profiles', 'profiles exists');
select col_is_pk('public', 'profiles', 'id', 'profile id is the primary key');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'profiles belong to auth users');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has row level security enabled'
);

-- Fixed users cover trimming, provider fallback, Unicode truncation, and absent metadata.
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'profile-owner@example.test',
    '{"display_name":"  Ada Lovelace  ","avatar_url":"  https://example.test/ada.png  "}'),
  ('10000000-0000-0000-0000-000000000002', 'profile-other@example.test',
    '{"full_name":"  Grace Hopper  ","picture":"https://example.test/grace.png"}'),
  ('10000000-0000-0000-0000-000000000003', 'profile-long@example.test',
    jsonb_build_object('display_name', '  ' || repeat('é', 101) || '  ')),
  ('10000000-0000-0000-0000-000000000004', 'profile-missing@example.test', null),
  ('10000000-0000-0000-0000-000000000005', 'profile-blank@example.test',
    '{"display_name":"   ","avatar_url":"   "}');

select is(
  (select count(*) from public.profiles where id::text like '10000000-0000-0000-0000-%'),
  5::bigint, 'auth user inserts create exactly one profile each'
);
select is(
  (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'Ada Lovelace', 'initial display name is trimmed'
);
select is(
  (select avatar_url from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'https://example.test/ada.png', 'initial avatar URL is trimmed'
);
select is(
  (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  'Grace Hopper', 'provider full_name initializes the display name'
);
select is(
  (select avatar_url from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  'https://example.test/grace.png', 'provider picture initializes the avatar'
);
select is(
  (select char_length(display_name) from public.profiles where id = '10000000-0000-0000-0000-000000000003'),
  100, 'long metadata is truncated by characters, including multibyte Unicode'
);
select is(
  (select right(display_name, 1) from public.profiles where id = '10000000-0000-0000-0000-000000000003'),
  'é', 'truncation preserves complete Unicode characters'
);
select results_eq(
  $$select display_name, avatar_url from public.profiles where id = '10000000-0000-0000-0000-000000000004'$$,
  $$values (null::text, null::text)$$, 'missing metadata creates nullable profile fields'
);
select results_eq(
  $$select display_name, avatar_url from public.profiles where id = '10000000-0000-0000-0000-000000000005'$$,
  $$values (null::text, null::text)$$, 'blank metadata becomes null rather than violating the name constraint'
);

-- Real client grants reject anonymous reads and writes before RLS is reached.
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok(
  $$select * from public.profiles$$, '42501', null,
  'anonymous clients cannot read profiles'
);
select throws_ok(
  $$insert into public.profiles (id) values ('10000000-0000-0000-0000-000000000006')$$,
  '42501', null, 'anonymous clients cannot directly insert profiles'
);
select throws_ok(
  $$update public.profiles set display_name = 'Anonymous' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'anonymous clients cannot update profiles'
);
select throws_ok(
  $$delete from public.profiles where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'anonymous clients cannot delete profiles'
);
reset role;

-- Isolate RLS as a second boundary: even an accidental SELECT grant leaks zero rows.
-- Restore the real contract immediately; the whole test also rolls back.
grant select on public.profiles to anon;
set local role anon;
select is((select count(*) from public.profiles), 0::bigint, 'anonymous RLS exposes zero profiles');
reset role;
revoke select on public.profiles from anon;

select set_config(
  'test.profile_updated_at',
  (select updated_at::text from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  true
);
select set_config(
  'test.profile_created_at',
  (select created_at::text from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  true
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select results_eq(
  $$select id from public.profiles$$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid)$$,
  'authenticated owner can select exactly their profile'
);
with updated as (
  update public.profiles
  set display_name = 'Ada Byron', avatar_url = 'https://example.test/new.png'
  returning id
)
select is(
  (select array_agg(id) from updated),
  array['10000000-0000-0000-0000-000000000001'::uuid],
  'authenticated owner can update exactly their profile'
);
select results_eq(
  $$select display_name, avatar_url from public.profiles$$,
  $$values ('Ada Byron'::text, 'https://example.test/new.png'::text)$$,
  'allowed profile field updates are persisted'
);
select ok(
  (select updated_at > current_setting('test.profile_updated_at')::timestamptz from public.profiles),
  'an allowed profile update advances updated_at'
);
select is(
  (select created_at from public.profiles), current_setting('test.profile_created_at')::timestamptz,
  'allowed profile updates preserve created_at'
);
select throws_ok(
  $$update public.profiles set id = '10000000-0000-0000-0000-000000000006'$$,
  '42501', null, 'clients cannot update profile id'
);
select throws_ok(
  $$update public.profiles set created_at = '2000-01-01'$$,
  '42501', null, 'clients cannot update created_at'
);
select throws_ok(
  $$update public.profiles set updated_at = '2000-01-01'$$,
  '42501', null, 'clients cannot update updated_at'
);
select throws_ok(
  $$delete from public.profiles where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'authenticated clients cannot delete profiles'
);
select throws_ok(
  $$insert into public.profiles (id) values ('10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'authenticated clients cannot directly insert their own profile'
);
select throws_ok(
  $$insert into public.profiles (id) values ('10000000-0000-0000-0000-000000000006')$$,
  '42501', null, 'authenticated clients cannot directly insert another profile'
);
select throws_ok(
  $$update public.profiles set display_name = ''$$,
  '23514', null, 'an empty display name is rejected'
);
select throws_ok(
  $$update public.profiles set display_name = repeat('x', 101)$$,
  '23514', null, 'display names over 100 characters are rejected'
);
with cleared as (
  update public.profiles set display_name = null, avatar_url = null
  returning display_name, avatar_url
)
select ok(
  (select display_name is null and avatar_url is null from cleared),
  'the owner can clear optional profile fields'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select is(
  (select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  0::bigint, 'another authenticated user cannot select the owner profile'
);
with updated as (
  update public.profiles set display_name = 'Stolen'
  where id = '10000000-0000-0000-0000-000000000001'
  returning id
)
select is(
  (select count(*) from updated), 0::bigint,
  'another authenticated user cannot update the owner profile'
);
select results_eq(
  $$select id from public.profiles$$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid)$$,
  'the second authenticated user sees exactly their own profile'
);
reset role;
select is(
  (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  null::text, 'rejected cross-user update leaves the owner profile unchanged'
);
select throws_ok(
  $$insert into public.profiles (id) values ('10000000-0000-0000-0000-000000000006')$$,
  '23503', null, 'profiles cannot reference a nonexistent auth user'
);
delete from auth.users where id = '10000000-0000-0000-0000-000000000005';
select is(
  (select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000005'),
  0::bigint, 'deleting an auth user cascades to their profile'
);

select * from finish();
rollback;

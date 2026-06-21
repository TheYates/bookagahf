-- Remove the FK constraint from profiles.id → auth.users.id
-- Client profiles no longer need an auth user on creation.
-- Auth users are created lazily on first client login instead.
-- Admin/doctor profiles still set id = auth.uid() but the FK is not enforced.

alter table public.profiles drop constraint if exists profiles_id_fkey;

-- Set id default to gen_random_uuid() for profiles created without an auth user
alter table public.profiles alter column id set default gen_random_uuid();

-- Add new client_category enum values and columns to profiles
-- Run this in the Supabase SQL editor.

-- 1. Add new category enum values (each in its own transaction)
alter type public.client_category add value if not exists 'private_dependent';
alter type public.client_category add value if not exists 'junior_staff_dependent';
alter type public.client_category add value if not exists 'senior_staff_dependent';

-- 2. Add sex and date_of_birth columns to profiles
alter table public.profiles add column if not exists sex text;
alter table public.profiles add column if not exists date_of_birth text;

-- 3. Drop unused columns
alter table public.profiles drop column if exists dob;
alter table public.profiles drop column if exists date_registered;
alter table public.profiles drop column if exists first_attended;

-- 4. Add date_joined column as text (CSV date strings vary in format, store raw)
alter table public.profiles drop column if exists date_joined;
alter table public.profiles add column if not exists date_joined text;

-- 5. Clear email for client profiles (email isn't needed for clients)
update public.profiles set email = null where role = 'client';

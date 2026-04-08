-- Hospital Scheduling System schema for Supabase

create extension if not exists "pgcrypto";

create type if not exists public.client_category as enum (
  'private_cash',
  'private_sponsored',
  'nhis',
  'corporate',
  'other'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'client',
  full_name text,
  x_number text unique,
  company_number text,
  phone text,
  email text,
  address text,
  category public.client_category,
  emergency_contact_name text,
  emergency_contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_number text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.corporate_dependents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  x_number text,
  relationship text,
  created_at timestamptz not null default now()
);

create table if not exists public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.doctor_specialties (
  doctor_id uuid not null references public.profiles(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete cascade,
  primary key (doctor_id, specialty_id)
);

create table if not exists public.doctor_settings (
  doctor_id uuid primary key references public.profiles(id) on delete cascade,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  x_number text not null,
  company_number text,
  dependent_name text,
  dependent_x_number text,
  contact_phone text,
  contact_email text,
  doctor_id uuid not null references public.profiles(id) on delete restrict,
  specialty_id uuid references public.specialties(id) on delete set null,
  status text not null default 'scheduled',
  scheduled_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  rescheduled_from uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  channel text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key default 1,
  booking_buffer_hours int not null default 2,
  reschedule_style text not null default 'dialog', -- 'dialog' or 'inline'
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.settings (id, booking_buffer_hours, reschedule_style)
  values (1, 2, 'dialog')
  on conflict (id) do nothing;

create table if not exists public.otp_tokens (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  otp text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = role_name
  );
$$;

alter table public.profiles enable row level security;
alter table public.corporate_dependents enable row level security;
alter table public.doctor_settings enable row level security;
alter table public.doctor_availability enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id or public.has_role('admin'));
create policy "Profiles are updatable by owner" on public.profiles
  for update using (auth.uid() = id or public.has_role('admin'));
create policy "Profiles are insertable by service role" on public.profiles
  for insert with check (true);

create policy "Dependents selectable by owner" on public.corporate_dependents
  for select using (auth.uid() = employee_id or public.has_role('admin'));
create policy "Dependents manageable by owner" on public.corporate_dependents
  for all using (auth.uid() = employee_id or public.has_role('admin'));

create policy "Doctor settings manageable by doctor" on public.doctor_settings
  for all using (auth.uid() = doctor_id or public.has_role('admin'));

create policy "Doctor availability manageable by doctor" on public.doctor_availability
  for all using (auth.uid() = doctor_id or public.has_role('admin'));

create policy "Appointments readable by doctor or creator" on public.appointments
  for select using (
    auth.uid() = doctor_id
    or auth.uid() = created_by
    or public.has_role('admin')
  );
create policy "Appointments insert by authenticated" on public.appointments
  for insert with check (auth.uid() = created_by or public.has_role('admin'));
create policy "Appointments update by doctor or creator" on public.appointments
  for update using (
    auth.uid() = doctor_id
    or auth.uid() = created_by
    or public.has_role('admin')
  );

create policy "Notifications readable by owner" on public.notifications
  for select using (auth.uid() = user_id or public.has_role('admin'));
create policy "Notifications update by owner" on public.notifications
  for update using (auth.uid() = user_id or public.has_role('admin'));

create policy "Settings editable by admin" on public.settings
  for select using (public.has_role('admin'));
create policy "Settings update by admin" on public.settings
  for update using (public.has_role('admin'));

create policy "Push subscriptions by owner" on public.push_subscriptions
  for all using (auth.uid() = user_id or public.has_role('admin'));

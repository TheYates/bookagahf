-- Enable pg_trgm extension for fuzzy text search
create extension if not exists pg_trgm;

-- GIN trigram indexes for fuzzy matching on client search fields
create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin (full_name gin_trgm_ops);

create index if not exists profiles_x_number_trgm_idx
  on public.profiles using gin (x_number gin_trgm_ops);

create index if not exists profiles_company_number_trgm_idx
  on public.profiles using gin (company_number gin_trgm_ops);

create index if not exists profiles_phone_trgm_idx
  on public.profiles using gin (phone gin_trgm_ops);

-- Function: fuzzy search clients by name, x-number, phone, or company number
-- Returns profiles ranked by similarity to the search term.
-- Uses pg_trgm similarity() for ranking and the % operator for filtering.
create or replace function public.search_clients(search_term text)
returns table (
  id uuid,
  full_name text,
  x_number text,
  phone text,
  company_number text,
  category public.client_category,
  is_active boolean,
  similarity real
)
language sql
stable
as $$
  select
    p.id,
    p.full_name,
    p.x_number,
    p.phone,
    p.company_number,
    p.category,
    p.is_active,
    greatest(
      similarity(p.full_name, search_term),
      similarity(p.x_number, search_term),
      similarity(p.phone, search_term),
      similarity(p.company_number, search_term)
    ) as similarity
  from public.profiles p
  where p.role = 'client'
    and (
      p.full_name % search_term
      or p.x_number % search_term
      or p.phone % search_term
      or p.company_number % search_term
    )
  order by similarity desc
  limit 20;
$$;

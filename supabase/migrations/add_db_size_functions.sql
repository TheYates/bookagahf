-- Database size monitoring functions for the admin storage page.
-- Run this in the Supabase SQL editor.

-- Returns the total database size in bytes.
create or replace function public.get_db_size()
returns bigint
language sql
security definer
as $$
  select pg_database_size(current_database());
$$;

-- Returns per-table storage breakdown for all public schema tables.
create or replace function public.get_table_sizes()
returns table (table_name text, row_count bigint, total_bytes bigint)
language sql
security definer
as $$
  select
    relname::text as table_name,
    n_live_tup as row_count,
    pg_total_relation_size('public.' || quote_ident(relname)) as total_bytes
  from pg_stat_user_tables
  where schemaname = 'public'
  order by pg_total_relation_size('public.' || quote_ident(relname)) desc;
$$;

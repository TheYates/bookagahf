-- ============================================================
-- ONE-TIME CLEANUP: Delete all "Walk-In Patient" profiles
-- ============================================================
-- This script deletes all client profiles whose full_name
-- matches "Walk-In Patient" (case-insensitive).
--
-- Impact on related tables:
--   * appointments.created_by → SET NULL (no appointment loss)
--   * corporate_dependents   → CASCADE deleted
--   * notifications          → CASCADE deleted
--   * otp_tokens             → CASCADE deleted
--   * push_subscriptions     → CASCADE deleted
-- ============================================================

-- Step 1: Preview — count how many will be deleted
select count(*) as walkin_count
from public.profiles
where role = 'client'
  and full_name ilike 'Walk-In Patient';

-- Step 2: Preview — list them with related record counts
select
  p.id,
  p.full_name,
  p.x_number,
  p.email,
  p.is_active,
  (select count(*) from public.appointments a where a.created_by = p.id) as appointment_count,
  (select count(*) from public.corporate_dependents cd where cd.employee_id = p.id) as dependent_count,
  (select count(*) from public.notifications n where n.user_id = p.id) as notification_count
from public.profiles p
where p.role = 'client'
  and p.full_name ilike 'Walk-In Patient';

-- Step 3: DELETE — uncomment below to execute
-- begin;
-- delete from public.profiles
-- where role = 'client'
--   and full_name ilike 'Walk-In Patient';
-- commit;

-- Step 4: Verify deletion
-- select count(*) as remaining_walkin_count
-- from public.profiles
-- where role = 'client'
--   and full_name ilike 'Walk-In Patient';

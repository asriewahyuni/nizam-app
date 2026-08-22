-- ============================================================
-- MIGRATION 1424: Migrate existing provider values based on user_type
-- ============================================================

-- 1. Update Kojasmat members ('anggota') to provider 'kojasmat'
UPDATE public.internal_auth_users 
SET provider = 'kojasmat' 
WHERE user_type = 'anggota' AND provider = 'platform';

-- 2. Update LMS members ('member') to provider 'LMS'
UPDATE public.internal_auth_users 
SET provider = 'LMS' 
WHERE user_type = 'member' AND provider = 'platform';

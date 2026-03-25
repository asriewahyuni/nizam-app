-- ============================================================
-- MIGRATION 1010: Zakat Intra-Day Real-Time History Tracking
-- ============================================================
-- This script removes the 1-point-per-day limit so the chart
-- can display every precise value change throughout the day.

ALTER TABLE public.zakat_haul_events DROP CONSTRAINT IF EXISTS zakat_haul_events_haul_id_event_date_key;

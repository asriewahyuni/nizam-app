-- Link grup diskusi (WhatsApp/Telegram/dsb) per batch/angkatan, dikelola admin
-- dan ditampilkan ke peserta di tab "Diskusi" halaman lesson.

ALTER TABLE public.lms_course_batches
  ADD COLUMN IF NOT EXISTS discussion_group_url TEXT;

COMMENT ON COLUMN public.lms_course_batches.discussion_group_url IS
  'Tautan grup diskusi resmi (WhatsApp/Telegram/dsb) untuk angkatan ini, ditampilkan ke peserta di tab Diskusi.';

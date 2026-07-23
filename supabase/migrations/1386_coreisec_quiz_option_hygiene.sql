-- =============================================================================
-- 1386_coreisec_quiz_option_hygiene.sql
-- Hilangkan penanda jawaban benar yang pernah ikut tersimpan pada judul opsi
-- LearnPress lama. Migrasi aman dijalankan berulang karena hanya menyentuh
-- nilai yang masih memiliki penanda di bagian awal.
-- =============================================================================

UPDATE public.learning_question_options
SET option_html = regexp_replace(
  option_html,
  '^([[:space:]]*(<[[:alpha:]][^>]*>[[:space:]]*)*)\[[[:space:]]*(true|correct|benar)[[:space:]]*\][[:space:]]*([-:–—][[:space:]]*)?',
  '\1',
  'i'
)
WHERE option_html ~* '^([[:space:]]*(<[[:alpha:]][^>]*>[[:space:]]*)*)\[[[:space:]]*(true|correct|benar)[[:space:]]*\]';

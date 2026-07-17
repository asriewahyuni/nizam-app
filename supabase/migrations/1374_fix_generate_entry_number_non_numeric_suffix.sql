-- Root cause dari "invalid input syntax for type integer: KOREKS-B" (dan akan memblokir
-- SEMUA pembuatan jurnal baru untuk org manapun yang punya entry_number non-standar):
-- generate_entry_number() memakai MAX(entry_number) via perbandingan TEXT, jadi entry_number
-- non-numerik seperti 'JE-2026-KOREKS-B' (huruf > digit secara ASCII) terpilih sebagai "terbesar",
-- lalu gagal saat suffix-nya di-cast ke INT. Perbaiki dengan hanya mempertimbangkan entry_number
-- yang polanya benar-benar JE-YYYY-NNNNNN (suffix numerik murni).

CREATE OR REPLACE FUNCTION public.generate_entry_number(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  v_year   TEXT := TO_CHAR(NOW(), 'YYYY');
  v_prefix TEXT;
  v_seq    INT;
BEGIN
  v_prefix := 'JE-' || v_year || '-';

  SELECT COALESCE(MAX(SUBSTRING(entry_number FROM LENGTH(v_prefix) + 1)::INT), 0) + 1
  INTO v_seq
  FROM journal_entries
  WHERE org_id = p_org_id
    AND entry_number ~ ('^' || v_prefix || '[0-9]+$');

  RETURN v_prefix || LPAD(v_seq::TEXT, 6, '0');
END;
$function$

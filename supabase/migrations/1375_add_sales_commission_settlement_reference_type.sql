-- settleResellerCommissionPayments() memposting jurnal dengan reference_type
-- 'SALES_COMMISSION_SETTLEMENT', tapi nilai itu belum terdaftar di enum
-- journal_reference_type, sehingga setiap pencairan komisi gagal dengan
-- "invalid input value for enum journal_reference_type". Tambahkan nilainya
-- (juga dibutuhkan supaya cabang SALES_COMMISSION_SETTLEMENT di voidJournalEntry
-- benar-benar bisa tercapai, bukan jatuh ke reference_type MANUAL yang ambigu).

ALTER TYPE public.journal_reference_type ADD VALUE IF NOT EXISTS 'SALES_COMMISSION_SETTLEMENT';

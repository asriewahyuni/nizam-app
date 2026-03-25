-- ============================================================
-- MIGRATION 1013: Asset Disposal (Pelepasan / Penjualan Aset Tetap)
-- ============================================================

-- CATATAN: Kita menggunakan reference_type = 'ADJUSTMENT' yang sudah ada di enum,
-- karena ALTER TYPE tidak bisa berjalan dalam transaksi yang sama dengan CREATE FUNCTION.
-- Jurnal disposal akan mudah diidentifikasi dari description-nya yang mengandung 'Pelepasan Aset'.

CREATE OR REPLACE FUNCTION public.process_asset_disposal(
    p_org_id UUID,
    p_asset_id UUID,
    p_sale_price DECIMAL,
    p_sale_date DATE,
    p_cash_account_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset RECORD;
    v_je_id UUID;
    v_book_value DECIMAL;
    v_gain_loss DECIMAL;
    acc_gain UUID;
    acc_loss UUID;
BEGIN
    -- 1. Fetch asset
    SELECT * INTO v_asset FROM public.fixed_assets WHERE id = p_asset_id AND org_id = p_org_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aset tidak ditemukan.');
    END IF;
    IF v_asset.status = 'DISPOSED' OR v_asset.status = 'SOLD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aset ini sudah pernah dilepas/dijual sebelumnya.');
    END IF;

    v_book_value := COALESCE(v_asset.current_book_value, 0);
    v_gain_loss := p_sale_price - v_book_value; -- Positif = Gain, Negatif = Loss

    -- 2. Cari akun Keuntungan & Kerugian pelepasan aset di COA org ini
    SELECT id INTO acc_gain FROM public.accounts WHERE org_id = p_org_id AND code = '7001' LIMIT 1;
    SELECT id INTO acc_loss FROM public.accounts WHERE org_id = p_org_id AND code = '7002' LIMIT 1;

    -- Jika belum ada, buat otomatis
    IF acc_gain IS NULL THEN
        INSERT INTO public.accounts (org_id, code, name, type, normal_balance, is_active)
        VALUES (p_org_id, '7001', 'Keuntungan Pelepasan Aset', 'REVENUE', 'CREDIT', true)
        RETURNING id INTO acc_gain;
    END IF;
    IF acc_loss IS NULL THEN
        INSERT INTO public.accounts (org_id, code, name, type, normal_balance, is_active)
        VALUES (p_org_id, '7002', 'Kerugian Pelepasan Aset', 'EXPENSE', 'DEBIT', true)
        RETURNING id INTO acc_loss;
    END IF;

    -- 3. Buat Jurnal Entry
    INSERT INTO public.journal_entries (org_id, entry_date, description, reference_type, reference_id, status)
    VALUES (
        p_org_id,
        p_sale_date,
        COALESCE(p_notes, 'Pelepasan Aset: ' || v_asset.name),
        'ADJUSTMENT',
        p_asset_id,
        'POSTED'
    )
    RETURNING id INTO v_je_id;

    -- 4. Jurnal Lines:
    -- (D) Akumulasi Penyusutan (hapus saldo kredit normal)
    IF COALESCE(v_asset.accumulated_depreciation, 0) > 0 AND v_asset.accum_dep_account_id IS NOT NULL THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, v_asset.accum_dep_account_id, v_asset.accumulated_depreciation, 0);
    END IF;

    -- (D) Kas/Bank diterima
    IF p_sale_price > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, p_cash_account_id, p_sale_price, 0);
    END IF;

    -- (C) Aset Tetap (hapus nilai bruto)
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_asset.asset_account_id, 0, v_asset.purchase_price);

    -- (C) Keuntungan ATAU (D) Kerugian
    IF v_gain_loss > 0 THEN
        -- Gain: Kredit akun Keuntungan
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, acc_gain, 0, v_gain_loss);
    ELSIF v_gain_loss < 0 THEN
        -- Loss: Debit akun Kerugian
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, acc_loss, ABS(v_gain_loss), 0);
    END IF;
    -- Jika impas (v_gain_loss = 0), tidak perlu baris tambahan

    -- 5. Update status aset menjadi SOLD
    UPDATE public.fixed_assets
    SET status = 'SOLD',
        current_book_value = 0,
        updated_at = NOW()
    WHERE id = p_asset_id;

    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_je_id,
        'book_value', v_book_value,
        'sale_price', p_sale_price,
        'gain_loss', v_gain_loss
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';

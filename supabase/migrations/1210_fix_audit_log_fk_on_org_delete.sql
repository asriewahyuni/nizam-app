-- ============================================================
-- MIGRATION 1210: Skip Audit Writes When Parent Org Is Gone
-- ============================================================
-- Why:
-- Deleting an organization cascades into child tables such as org_members.
-- Their audit trigger still tries to insert into public.audit_logs using the
-- deleted org_id, which violates audit_logs_org_id_fkey because the parent
-- organization row is already gone in the same cascade chain.

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    -- Coba ambil ID user yang sedang login dari konteks JWT Supabase
    -- Jika dieksekusi oleh sistem (Cron/Service Role), user_id akan null.
    v_user_id := auth.uid();

    -- Ambil org_id dari record (karena semua tabel yang dipasang trigger ini punya org_id)
    IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.org_id;
    ELSE
        v_org_id := NEW.org_id;
    END IF;

    -- Saat parent org sedang/habis dihapus oleh cascade, skip audit write agar
    -- tidak menabrak FK audit_logs.org_id -> organizations.id.
    IF v_org_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = v_org_id
    ) THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    -- Rekam aksi ke tabel audit_logs berdasarkan tipe operasi
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, new_data)
        VALUES (v_org_id, v_user_id, 'CREATE', TG_TABLE_NAME, NEW.id, row_to_json(NEW)::jsonb);
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Jangan rekam jika datanya sama persis (hanya sentuh timestamp)
        IF row_to_json(OLD)::jsonb = row_to_json(NEW)::jsonb THEN
            RETURN NEW;
        END IF;

        -- Gunakan jsonb extraction agar tidak error saat tabel (misal: products) tidak punya kolom "status"
        IF TG_TABLE_NAME IN ('purchases', 'sales', 'journal_entries')
           AND (row_to_json(NEW)->>'status') = 'VOIDED'
           AND (row_to_json(OLD)->>'status') != 'VOIDED' THEN

            INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, old_data, new_data)
            VALUES (v_org_id, v_user_id, 'VOID', TG_TABLE_NAME, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        ELSE
            INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, old_data, new_data)
            VALUES (v_org_id, v_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, old_data)
        VALUES (v_org_id, v_user_id, 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

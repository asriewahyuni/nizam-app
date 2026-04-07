


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "public"."account_type" AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."approval_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE "public"."approval_status" OWNER TO "postgres";


CREATE TYPE "public"."attendance_status" AS ENUM (
    'PRESENT',
    'LATE',
    'ABSENT',
    'LEAVE',
    'SICK',
    'HALFDAY'
);


ALTER TYPE "public"."attendance_status" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'RESERVED',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."cash_transaction_type" AS ENUM (
    'IN',
    'OUT',
    'TRANSFER'
);


ALTER TYPE "public"."cash_transaction_type" OWNER TO "postgres";


CREATE TYPE "public"."coa_request_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


ALTER TYPE "public"."coa_request_status" OWNER TO "postgres";


CREATE TYPE "public"."depreciation_method" AS ENUM (
    'STRAIGHT_LINE',
    'DOUBLE_DECLINING_BALANCE',
    'NON_DEPRECIABLE'
);


ALTER TYPE "public"."depreciation_method" OWNER TO "postgres";


CREATE TYPE "public"."document_status" AS ENUM (
    'DRAFT',
    'ORDERED',
    'RECEIVED',
    'FINISHED',
    'VOIDED',
    'QUOTATION',
    'DELIVERED'
);


ALTER TYPE "public"."document_status" OWNER TO "postgres";


CREATE TYPE "public"."employment_status" AS ENUM (
    'FULL_TIME',
    'CONTRACT',
    'PROBATION',
    'INTERN',
    'TERMINATED',
    'RESIGNED'
);


ALTER TYPE "public"."employment_status" OWNER TO "postgres";


CREATE TYPE "public"."fleet_status" AS ENUM (
    'AVAILABLE',
    'RENTED',
    'MAINTENANCE',
    'OUT_OF_SERVICE'
);


ALTER TYPE "public"."fleet_status" OWNER TO "postgres";


CREATE TYPE "public"."fleet_type" AS ENUM (
    'CAR',
    'MOTORBIKE',
    'BUS',
    'TRUCK',
    'OTHER'
);


ALTER TYPE "public"."fleet_type" OWNER TO "postgres";


CREATE TYPE "public"."inventory_adjustment_type" AS ENUM (
    'STOCK_COUNT',
    'WRITE_OFF'
);


ALTER TYPE "public"."inventory_adjustment_type" OWNER TO "postgres";


CREATE TYPE "public"."journal_reference_type" AS ENUM (
    'MANUAL',
    'CASH_IN',
    'CASH_OUT',
    'SALE',
    'PURCHASE',
    'GOODS_RECEIPT',
    'GOODS_SHIPMENT',
    'PAYMENT_IN',
    'PAYMENT_OUT',
    'BANK_TRANSFER',
    'PAYROLL',
    'ADJUSTMENT',
    'TAX',
    'DEPRECIATION',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'PURCHASE_PAYMENT',
    'TRANSFER',
    'EMPLOYEE_EXPENSE',
    'INVENTORY_ADJ',
    'PRODUCTION'
);


ALTER TYPE "public"."journal_reference_type" OWNER TO "postgres";


CREATE TYPE "public"."journal_status" AS ENUM (
    'DRAFT',
    'POSTED',
    'VOIDED'
);


ALTER TYPE "public"."journal_status" OWNER TO "postgres";


CREATE TYPE "public"."leave_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE "public"."leave_status" OWNER TO "postgres";


CREATE TYPE "public"."member_role" AS ENUM (
    'owner',
    'admin',
    'manager',
    'staff',
    'viewer',
    'hr'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE TYPE "public"."nizam_department" AS ENUM (
    'DASHBOARD_AUDIT',
    'INSIGHT',
    'IT',
    'CONFIG',
    'FINANCE',
    'OPERASIONAL',
    'MARKETING_SALES',
    'HRIS'
);


ALTER TYPE "public"."nizam_department" OWNER TO "postgres";


CREATE TYPE "public"."normal_balance" AS ENUM (
    'DEBIT',
    'CREDIT'
);


ALTER TYPE "public"."normal_balance" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'UNPAID',
    'PARTIAL',
    'PAID',
    'OVERDUE'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."payroll_item_type" AS ENUM (
    'EARNING',
    'DEDUCTION',
    'TAX',
    'BENEFIT'
);


ALTER TYPE "public"."payroll_item_type" OWNER TO "postgres";


CREATE TYPE "public"."payroll_status" AS ENUM (
    'DRAFT',
    'APPROVED',
    'PAID'
);


ALTER TYPE "public"."payroll_status" OWNER TO "postgres";


CREATE TYPE "public"."pr_status" AS ENUM (
    'PENDING',
    'ORDERED',
    'RECEIVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE "public"."pr_status" OWNER TO "postgres";


CREATE TYPE "public"."product_type" AS ENUM (
    'INVENTORY',
    'NON_INVENTORY',
    'SERVICE'
);


ALTER TYPE "public"."product_type" OWNER TO "postgres";


CREATE TYPE "public"."schedule_status" AS ENUM (
    'SCHEDULED',
    'DEPARTED',
    'ARRIVED',
    'CANCELLED'
);


ALTER TYPE "public"."schedule_status" OWNER TO "postgres";


CREATE TYPE "public"."shariah_mode" AS ENUM (
    'CASH',
    'SALAM',
    'ISTISHNA'
);


ALTER TYPE "public"."shariah_mode" OWNER TO "postgres";


CREATE TYPE "public"."ticket_status" AS ENUM (
    'BOOKED',
    'PAID',
    'USED',
    'CANCELLED'
);


ALTER TYPE "public"."ticket_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.adjust_inventory_stock(
      p_org_id,
      p_product_id,
      p_warehouse_id,
      p_diff,
      NULL::TEXT,
      NULL::UUID
    );
END;
$$;


ALTER FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric, "p_batch_number" "text" DEFAULT NULL::"text", "p_bin_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_stock_id UUID;
BEGIN
    SELECT id
    INTO v_stock_id
    FROM public.inventory_stocks
    WHERE org_id = p_org_id
      AND product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND batch_number IS NOT DISTINCT FROM p_batch_number
      AND bin_id IS NOT DISTINCT FROM p_bin_id
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1
    FOR UPDATE;

    IF v_stock_id IS NOT NULL THEN
      UPDATE public.inventory_stocks
      SET quantity = quantity + p_diff,
          updated_at = NOW()
      WHERE id = v_stock_id;
      RETURN;
    END IF;

    INSERT INTO public.inventory_stocks (
      org_id,
      product_id,
      warehouse_id,
      quantity,
      batch_number,
      bin_id
    )
    VALUES (
      p_org_id,
      p_product_id,
      p_warehouse_id,
      p_diff,
      p_batch_number,
      p_bin_id
    );
END;
$$;


ALTER FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric, "p_batch_number" "text", "p_bin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_coa_request"("p_request_id" "uuid", "p_review_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_req               public.coa_account_requests%ROWTYPE;
  v_new_account_id    UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  -- Ambil request
  SELECT * INTO v_req
  FROM public.coa_account_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request CoA tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya request berstatus pending yang dapat disetujui. Status saat ini: %', v_req.status;
  END IF;

  -- Pemeriksa harus punya otoritas finance master di org Parent
  IF NOT public.can_manage_finance_master(v_req.org_id) THEN
    RAISE EXCEPTION 'Hanya Organisasi Utama (Parent) pada konteks Unit Utama yang dapat menyetujui request CoA.';
  END IF;

  -- Validasi: Pastikan kode tidak kembar dengan yang sudah ada di Parent
  IF EXISTS (
    SELECT 1 FROM public.accounts 
    WHERE org_id = v_req.org_id AND code = v_req.proposed_code
  ) THEN
    RAISE EXCEPTION 'Gagal setuju: Kode rekening "%" sudah ada di Buku Besar. Silakan TOLAK request ini dan minta cabang gunakan kode lain yang masih kosong.', v_req.proposed_code;
  END IF;

  -- Buat akun baru di CoA Parent dengan type casting eksplisit
  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    description,
    is_system
  ) VALUES (
    v_req.org_id,
    v_req.proposed_code,
    v_req.proposed_name,
    v_req.proposed_type::public.account_type,
    v_req.proposed_normal_balance::public.normal_balance,
    v_req.proposed_parent_id,
    v_req.proposed_description,
    FALSE
  )
  RETURNING id INTO v_new_account_id;

  -- Update status request
  UPDATE public.coa_account_requests
  SET
    status             = 'approved',
    reviewed_by        = auth.uid(),
    reviewed_at        = now(),
    review_notes       = p_review_notes,
    created_account_id = v_new_account_id
  WHERE id = p_request_id;

  RETURN v_new_account_id;
END;
$$;


ALTER FUNCTION "public"."approve_coa_request"("p_request_id" "uuid", "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_journal_bank_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_opp_gl_account_id UUID;
  v_ref_type journal_reference_type;
  v_bank_branch_id UUID;
BEGIN
  SELECT account_id, branch_id
  INTO v_bank_gl_account_id, v_bank_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id
    AND org_id = NEW.org_id;

  IF v_bank_gl_account_id IS NULL THEN
    RAISE EXCEPTION 'Bank account % tidak ditemukan untuk organisasi %', NEW.bank_account_id, NEW.org_id;
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := COALESCE(v_bank_branch_id, public.resolve_single_active_branch(NEW.org_id));
  END IF;

  IF NEW.branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank transaction journaling on organization %', NEW.org_id;
  END IF;

  IF v_bank_branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_bank_branch_id THEN
    RAISE EXCEPTION 'bank transaction branch % does not match bank account branch %', NEW.branch_id, v_bank_branch_id;
  END IF;

  v_opp_gl_account_id := NEW.category_id;

  IF v_opp_gl_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type::text = 'IN' THEN
    v_ref_type := 'CASH_IN';
  ELSIF NEW.type::text = 'TRANSFER' THEN
    v_ref_type := 'BANK_TRANSFER';
  ELSE
    v_ref_type := 'CASH_OUT';
  END IF;

  INSERT INTO public.journal_entries (
    org_id,
    branch_id,
    entry_date,
    description,
    reference_type,
    reference_id,
    status,
    is_auto,
    created_by
  ) VALUES (
    NEW.org_id,
    NEW.branch_id,
    NEW.transaction_date,
    NEW.description,
    v_ref_type,
    NEW.id,
    'POSTED',
    TRUE,
    NEW.created_by
  ) RETURNING id INTO v_je_id;

  IF NEW.type::text = 'IN' THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, NEW.amount, 0, NEW.description);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, 0, NEW.amount, NEW.description);
  ELSE
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_opp_gl_account_id, NEW.amount, 0, NEW.description);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_gl_account_id, 0, NEW.amount, NEW.description);
  END IF;

  NEW.journal_entry_id := v_je_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_journal_bank_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bootstrap_main_branch_on_org_create"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.branches (org_id, name, code, address, is_active)
  VALUES (NEW.id, 'Unit Utama', 'MAIN', NULL, TRUE)
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET is_active = TRUE,
        updated_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bootstrap_main_branch_on_org_create"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bootstrap_org_member_units"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.role IN ('owner', 'admin') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_member_units (org_member_id, org_id, branch_id)
  SELECT NEW.id, NEW.org_id, b.id
  FROM public.branches b
  WHERE b.org_id = NEW.org_id
    AND b.is_active = TRUE
  ON CONFLICT (org_member_id, branch_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bootstrap_org_member_units"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bootstrap_single_branch_member_units"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_single_branch_id UUID;
  v_active_branch_count INTEGER;
BEGIN
  IF COALESCE(NEW.is_active, FALSE) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_active_branch_count
  FROM public.branches
  WHERE org_id = NEW.org_id
    AND is_active = TRUE;

  IF v_active_branch_count <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT b.id
  INTO v_single_branch_id
  FROM public.branches b
  WHERE b.org_id = NEW.org_id
    AND b.is_active = TRUE
  ORDER BY b.created_at ASC, b.id ASC
  LIMIT 1;

  IF v_single_branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_member_units (org_member_id, org_id, branch_id)
  SELECT
    om.id,
    om.org_id,
    v_single_branch_id
  FROM public.org_members om
  WHERE om.org_id = NEW.org_id
    AND om.is_active = TRUE
    AND om.role NOT IN ('owner', 'admin')
    AND NOT EXISTS (
      SELECT 1
      FROM public.org_member_units omu
      WHERE omu.org_member_id = om.id
    )
  ON CONFLICT (org_member_id, branch_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bootstrap_single_branch_member_units"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bsc_calculate_achievement_percent"("p_actual" numeric, "p_target" numeric, "p_direction" "text") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_actual NUMERIC := COALESCE(p_actual, 0);
  v_target NUMERIC := COALESCE(p_target, 0);
  v_result NUMERIC := 0;
BEGIN
  IF v_target <= 0 THEN
    RETURN 0;
  END IF;

  IF p_direction = 'LOWER_BETTER' THEN
    IF v_actual <= 0 THEN
      RETURN 100;
    END IF;
    v_result := (v_target / v_actual) * 100;
  ELSE
    v_result := (v_actual / v_target) * 100;
  END IF;

  RETURN GREATEST(0, v_result);
END;
$$;


ALTER FUNCTION "public"."bsc_calculate_achievement_percent"("p_actual" numeric, "p_target" numeric, "p_direction" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bsc_score_100_from_achievement"("p_achievement" numeric) RETURNS numeric
    LANGUAGE "sql"
    AS $$
  SELECT LEAST(100, GREATEST(0, COALESCE(p_achievement, 0)));
$$;


ALTER FUNCTION "public"."bsc_score_100_from_achievement"("p_achievement" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bsc_score_4_from_score_100"("p_score_100" numeric) RETURNS numeric
    LANGUAGE "sql"
    AS $$
  SELECT ROUND((LEAST(100, GREATEST(0, COALESCE(p_score_100, 0))) / 25.0)::NUMERIC, 3);
$$;


ALTER FUNCTION "public"."bsc_score_4_from_score_100"("p_score_100" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_branch"("p_org_id" "uuid", "p_branch_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.is_active = TRUE
      AND om.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.org_member_units omu ON omu.org_member_id = om.id
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.is_active = TRUE
      AND omu.branch_id = p_branch_id
  );
$$;


ALTER FUNCTION "public"."can_access_branch"("p_org_id" "uuid", "p_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_branch_or_default"("p_org_id" "uuid", "p_branch_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_org_id IS NULL THEN FALSE
    WHEN COALESCE(p_branch_id, public.get_default_branch_id(p_org_id)) IS NULL THEN FALSE
    ELSE public.can_access_branch(
      p_org_id,
      COALESCE(p_branch_id, public.get_default_branch_id(p_org_id))
    )
  END
$$;


ALTER FUNCTION "public"."can_access_branch_or_default"("p_org_id" "uuid", "p_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_finance_master"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role member_role;
  v_last_active_branch_id UUID;
  v_default_branch_id UUID;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Allow internal DB/system contexts (migrations, seed, service role).
  IF auth.uid() IS NULL THEN
    RETURN TRUE;
  END IF;

  IF NOT public.is_main_organization(p_org_id) THEN
    RETURN FALSE;
  END IF;

  SELECT om.role, om.last_active_branch_id
  INTO v_role, v_last_active_branch_id
  FROM public.org_members om
  WHERE om.org_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.is_active = TRUE
  ORDER BY om.joined_at ASC
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  v_default_branch_id := public.get_default_branch_id(p_org_id);
  IF v_default_branch_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- User must be on MAIN branch context (or all-branch/null context).
  IF v_last_active_branch_id IS NOT NULL
     AND v_last_active_branch_id IS DISTINCT FROM v_default_branch_id THEN
    RETURN FALSE;
  END IF;

  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  IF public.nizam_has_permission('coa:write', p_org_id)
     OR public.nizam_has_permission('accounting:write', p_org_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."can_manage_finance_master"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_coa_request"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_req public.coa_account_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  SELECT * INTO v_req
  FROM public.coa_account_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request CoA tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya request berstatus pending yang dapat dibatalkan.';
  END IF;

  -- Hanya pengaju sendiri yang bisa membatalkan
  IF v_req.requested_by <> auth.uid() THEN
    RAISE EXCEPTION 'Anda tidak memiliki izin membatalkan request ini.';
  END IF;

  UPDATE public.coa_account_requests
  SET status = 'cancelled'
  WHERE id = p_request_id;
END;
$$;


ALTER FUNCTION "public"."cancel_coa_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_closed_period"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_org_id UUID;
  v_entry_date DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.org_id;
    v_entry_date := OLD.entry_date;
  ELSE
    v_org_id := NEW.org_id;
    v_entry_date := NEW.entry_date;
  END IF;

  IF v_org_id IS NULL OR v_entry_date IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM fiscal_periods
    WHERE org_id = v_org_id
      AND is_closed = TRUE
      AND v_entry_date BETWEEN start_date AND end_date
  ) THEN
    RAISE EXCEPTION 'Transaction is within a closed fiscal period and cannot be modified.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_closed_period"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_measurement_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_from TEXT := public.normalize_measurement_unit(COALESCE(p_from_unit, p_to_unit));
  v_to TEXT := public.normalize_measurement_unit(COALESCE(p_to_unit, p_from_unit));
BEGIN
  IF p_quantity IS NULL THEN
    RETURN 0;
  END IF;

  IF v_from = '' OR v_to = '' OR v_from = v_to THEN
    RETURN p_quantity;
  END IF;

  IF v_from = 'kg' AND v_to = 'gram' THEN
    RETURN p_quantity * 1000;
  ELSIF v_from = 'gram' AND v_to = 'kg' THEN
    RETURN p_quantity * 0.001;
  ELSIF v_from = 'liter' AND v_to = 'ml' THEN
    RETURN p_quantity * 1000;
  ELSIF v_from = 'ml' AND v_to = 'liter' THEN
    RETURN p_quantity * 0.001;
  ELSIF v_from = 'meter' AND v_to = 'cm' THEN
    RETURN p_quantity * 100;
  ELSIF v_from = 'cm' AND v_to = 'meter' THEN
    RETURN p_quantity * 0.01;
  ELSIF (v_from = 'pcs' AND v_to = 'unit') OR (v_from = 'unit' AND v_to = 'pcs') THEN
    RETURN p_quantity;
  END IF;

  RAISE EXCEPTION 'Konversi satuan tidak didukung: % -> %', COALESCE(p_from_unit, '-'), COALESCE(p_to_unit, '-');
END;
$$;


ALTER FUNCTION "public"."convert_measurement_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_fleet_medical_record"("p_org_id" "uuid", "p_asset_id" "uuid", "p_service_date" "date", "p_description" "text", "p_maintenance_type" "text", "p_cost" numeric, "p_odometer_at" numeric, "p_technician_name" "text" DEFAULT NULL::"text", "p_vendor_name" "text" DEFAULT NULL::"text", "p_parts_replaced" "jsonb" DEFAULT '[]'::"jsonb", "p_next_service_km" numeric DEFAULT NULL::numeric, "p_next_service_date" "date" DEFAULT NULL::"date", "p_attachment_url" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_record_id UUID;
BEGIN
  UPDATE public.fleet_assets
  SET status = 'MAINTENANCE',
      updated_at = NOW()
  WHERE org_id = p_org_id
    AND id = p_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Armada tidak ditemukan atau tidak dapat diakses.';
  END IF;

  INSERT INTO public.fleet_maintenance_labs (
    org_id,
    asset_id,
    service_date,
    description,
    maintenance_type,
    cost,
    odometer_at,
    technician_name,
    vendor_name,
    parts_replaced,
    next_service_km,
    next_service_date,
    attachment_url
  )
  VALUES (
    p_org_id,
    p_asset_id,
    p_service_date,
    p_description,
    p_maintenance_type,
    p_cost,
    p_odometer_at,
    p_technician_name,
    p_vendor_name,
    COALESCE(p_parts_replaced, '[]'::jsonb),
    p_next_service_km,
    p_next_service_date,
    p_attachment_url
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;


ALTER FUNCTION "public"."create_fleet_medical_record"("p_org_id" "uuid", "p_asset_id" "uuid", "p_service_date" "date", "p_description" "text", "p_maintenance_type" "text", "p_cost" numeric, "p_odometer_at" numeric, "p_technician_name" "text", "p_vendor_name" "text", "p_parts_replaced" "jsonb", "p_next_service_km" numeric, "p_next_service_date" "date", "p_attachment_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_interorg_capital_transfer"("p_source_org_id" "uuid", "p_source_bank_account_id" "uuid", "p_source_counter_account_id" "uuid", "p_target_bank_account_id" "uuid", "p_target_counter_account_id" "uuid", "p_transaction_date" "date", "p_amount" numeric, "p_description" "text", "p_reference_number" "text" DEFAULT NULL::"text") RETURNS TABLE("source_transaction_id" "uuid", "target_transaction_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid UUID;
  v_source_bank RECORD;
  v_target_bank RECORD;
  v_source_counter_account RECORD;
  v_source_tx_id UUID;
  v_target_tx_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  IF p_source_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisasi sumber wajib diisi.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal transfer wajib lebih besar dari 0.';
  END IF;

  IF p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'Tanggal transaksi wajib diisi.';
  END IF;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'Deskripsi transaksi wajib diisi.';
  END IF;

  IF NOT public.can_manage_finance_master(p_source_org_id) THEN
    RAISE EXCEPTION 'Hanya Parent/Holding pada konteks unit utama yang dapat melakukan transfer modal antar entitas.';
  END IF;

  SELECT id, org_id, branch_id, account_id
  INTO v_source_bank
  FROM public.bank_accounts
  WHERE id = p_source_bank_account_id
    AND org_id = p_source_org_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rekening sumber tidak ditemukan atau tidak aktif.';
  END IF;

  SELECT id, org_id, branch_id, account_id
  INTO v_target_bank
  FROM public.bank_accounts
  WHERE id = p_target_bank_account_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rekening tujuan tidak ditemukan atau tidak aktif.';
  END IF;

  IF v_target_bank.org_id = p_source_org_id THEN
    RAISE EXCEPTION 'Gunakan transfer internal biasa untuk rekening pada organisasi yang sama.';
  END IF;

  IF NOT public.is_org_in_consolidation_tree(v_target_bank.org_id, p_source_org_id) THEN
    RAISE EXCEPTION 'Organisasi tujuan tidak termasuk dalam struktur parent/holding sumber.';
  END IF;

  SELECT id, org_id, code, name, type, is_active
    INTO v_source_counter_account
  FROM public.accounts
  WHERE id = p_source_counter_account_id
    AND org_id = p_source_org_id
    AND is_active = TRUE
  LIMIT 1;

  IF v_source_counter_account.id IS NULL THEN
    RAISE EXCEPTION 'Akun lawan parent (sumber) tidak valid.';
  END IF;

  IF NOT (
    v_source_counter_account.type = 'ASSET'
    AND (
      v_source_counter_account.code LIKE '11%%'
      OR v_source_counter_account.name ILIKE '%%kas%%'
      OR v_source_counter_account.name ILIKE '%%bank%%'
    )
  ) THEN
    RAISE EXCEPTION
      'Akun lawan parent harus akun kas/bank anak (kelompok 11xx), bukan akun investasi.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = p_target_counter_account_id
      AND org_id = v_target_bank.org_id
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Akun lawan entitas tujuan tidak valid.';
  END IF;

  IF p_source_counter_account_id = v_source_bank.account_id THEN
    RAISE EXCEPTION 'Akun lawan parent tidak boleh sama dengan akun kas/bank sumber.';
  END IF;

  IF p_target_counter_account_id = v_target_bank.account_id THEN
    RAISE EXCEPTION 'Akun lawan entitas tujuan tidak boleh sama dengan akun kas/bank tujuan.';
  END IF;

  INSERT INTO public.bank_transactions (
    org_id,
    branch_id,
    bank_account_id,
    transaction_date,
    description,
    amount,
    type,
    category_id,
    reference_number,
    status,
    created_by
  ) VALUES (
    p_source_org_id,
    v_source_bank.branch_id,
    p_source_bank_account_id,
    p_transaction_date,
    btrim(p_description),
    p_amount,
    'TRANSFER',
    p_source_counter_account_id,
    p_reference_number,
    'POSTED',
    v_uid
  )
  RETURNING id INTO v_source_tx_id;

  INSERT INTO public.bank_transactions (
    org_id,
    branch_id,
    bank_account_id,
    transaction_date,
    description,
    amount,
    type,
    category_id,
    reference_number,
    status,
    created_by
  ) VALUES (
    v_target_bank.org_id,
    v_target_bank.branch_id,
    p_target_bank_account_id,
    p_transaction_date,
    btrim(p_description),
    p_amount,
    'IN',
    p_target_counter_account_id,
    p_reference_number,
    'POSTED',
    v_uid
  )
  RETURNING id INTO v_target_tx_id;

  RETURN QUERY SELECT v_source_tx_id, v_target_tx_id;
END;
$$;


ALTER FUNCTION "public"."create_interorg_capital_transfer"("p_source_org_id" "uuid", "p_source_bank_account_id" "uuid", "p_source_counter_account_id" "uuid", "p_target_bank_account_id" "uuid", "p_target_counter_account_id" "uuid", "p_transaction_date" "date", "p_amount" numeric, "p_description" "text", "p_reference_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_org_inventory"("p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_products_count INTEGER;
    v_stocks_count INTEGER;
    v_total_value NUMERIC := 0;
BEGIN
    SELECT count(*) INTO v_products_count FROM public.products WHERE org_id = p_org_id;
    SELECT count(*) INTO v_stocks_count FROM public.inventory_stocks WHERE org_id = p_org_id;

    SELECT COALESCE(SUM(s.quantity * p.average_cost), 0) INTO v_total_value
    FROM public.inventory_stocks s
    JOIN public.products p ON s.product_id = p.id
    WHERE s.org_id = p_org_id;

    RETURN jsonb_build_object(
        'org_id', p_org_id,
        'products_count', v_products_count,
        'stocks_count', v_stocks_count,
        'logic_value', v_total_value
    );
END;
$$;


ALTER FUNCTION "public"."debug_org_inventory"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_org_cascade"("target_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Bersihkan Log Audit
    DELETE FROM audit_logs WHERE org_id = target_org_id;
    
    -- Hapus Organisasi ( CASCADE di database akan urus sisa tabel lainnya)
    DELETE FROM organizations WHERE id = target_org_id;
END;
$$;


ALTER FUNCTION "public"."delete_org_cascade"("target_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_accounts_delete_governance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF COALESCE(OLD.is_system, FALSE) = TRUE THEN
    RAISE EXCEPTION 'Akun sistem tidak dapat dihapus.';
  END IF;

  IF NOT public.can_manage_finance_master(OLD.org_id) THEN
    RAISE EXCEPTION
      'Hanya Organisasi Utama pada konteks Unit Utama yang dapat menghapus rekening CoA.';
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."enforce_accounts_delete_governance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_accounts_governance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_default_branch_id UUID;
  v_org_has_members BOOLEAN := FALSE;
BEGIN
  v_default_branch_id := public.get_default_branch_id(NEW.org_id);

  IF v_default_branch_id IS NULL THEN
    RAISE EXCEPTION 'Unit Utama organisasi % belum tersedia.', NEW.org_id;
  END IF;

  IF NEW.managed_branch_id IS NULL THEN
    NEW.managed_branch_id := v_default_branch_id;
  END IF;

  IF NEW.managed_branch_id IS DISTINCT FROM v_default_branch_id THEN
    RAISE EXCEPTION 'Rekening CoA wajib terhubung ke Unit Utama organisasi.';
  END IF;

  -- Protect custom accounts: only main-org/main-branch finance authority can mutate.
  IF COALESCE(NEW.is_system, FALSE) = FALSE
     AND NOT public.can_manage_finance_master(NEW.org_id) THEN
    RAISE EXCEPTION
      'Hanya Organisasi Utama pada konteks Unit Utama yang dapat membuat/mengubah rekening CoA.';
  END IF;

  -- Protect system accounts from arbitrary manual inserts/edits once memberships exist.
  IF COALESCE(NEW.is_system, FALSE) = TRUE
     AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = NEW.org_id
        AND om.is_active = TRUE
    )
    INTO v_org_has_members;

    IF v_org_has_members
       AND NOT public.is_org_admin(NEW.org_id) THEN
      RAISE EXCEPTION 'Akun sistem hanya dapat dikelola owner/admin organisasi.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_accounts_governance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_accounts_governance_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_default_branch_id UUID;
  v_org_has_members   BOOLEAN := FALSE;
BEGIN
  v_default_branch_id := public.get_default_branch_id(NEW.org_id);

  IF v_default_branch_id IS NULL THEN
    v_default_branch_id := public.ensure_main_branch_for_org(NEW.org_id);
  END IF;

  IF v_default_branch_id IS NULL THEN
    v_default_branch_id := public.get_default_branch_id(NEW.org_id);
  END IF;

  IF v_default_branch_id IS NULL THEN
    RAISE EXCEPTION 'Unit Utama organisasi % belum tersedia.', NEW.org_id;
  END IF;

  IF NEW.managed_branch_id IS NULL THEN
    NEW.managed_branch_id := v_default_branch_id;
  END IF;

  IF NEW.managed_branch_id IS DISTINCT FROM v_default_branch_id THEN
    RAISE EXCEPTION 'Rekening CoA wajib terhubung ke Unit Utama organisasi.';
  END IF;

  IF COALESCE(NEW.is_system, FALSE) = FALSE
     AND NOT public.can_manage_finance_master(NEW.org_id) THEN
    RAISE EXCEPTION
      'Hanya Organisasi Utama pada konteks Unit Utama yang dapat membuat/mengubah rekening CoA.';
  END IF;

  IF COALESCE(NEW.is_system, FALSE) = TRUE
     AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.org_members om
      WHERE om.org_id = NEW.org_id
        AND om.is_active = TRUE
    ) INTO v_org_has_members;

    IF v_org_has_members
       AND NOT public.is_org_admin(NEW.org_id) THEN
      RAISE EXCEPTION 'Akun sistem hanya dapat dikelola owner/admin organisasi.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_accounts_governance_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_coa_request_governance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_requester_in_tree  BOOLEAN;
  v_is_requester_parent   BOOLEAN;
BEGIN
  -- Pastikan requester_org adalah bagian dari hierarki org_id (parent)
  v_is_requester_in_tree := public.is_org_in_consolidation_tree(NEW.requester_org_id, NEW.org_id);
  IF NOT v_is_requester_in_tree THEN
    RAISE EXCEPTION
      'Organisasi pengaju bukan bagian dari struktur konsolidasi parent yang dituju.';
  END IF;

  -- Parent/Holding tidak perlu mengajukan request ke dirinya sendiri
  v_is_requester_parent := (NEW.requester_org_id = NEW.org_id);
  IF v_is_requester_parent THEN
    RAISE EXCEPTION
      'Organisasi Parent/Holding tidak perlu mengajukan request. Buat langsung akun CoA.';
  END IF;

  -- Status awal harus selalu pending
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.review_notes := NULL;
  NEW.created_account_id := NULL;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_coa_request_governance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_inventory_segment_accounts"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1100'
  LIMIT 1;

  IF v_parent_id IS NULL THEN
    SELECT id INTO v_parent_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '1000'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id, code, name, type, normal_balance, parent_id, is_system, is_active
  ) VALUES (
    p_org_id, '1302', 'Persediaan Barang Dalam Proses', 'ASSET', 'DEBIT', v_parent_id, TRUE, TRUE
  )
  ON CONFLICT (org_id, code) DO UPDATE
  SET name = EXCLUDED.name,
      type = 'ASSET',
      normal_balance = 'DEBIT',
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_system = TRUE,
      is_active = TRUE,
      updated_at = NOW();

  INSERT INTO public.accounts (
    org_id, code, name, type, normal_balance, parent_id, is_system, is_active
  ) VALUES (
    p_org_id, '1303', 'Persediaan Bahan Baku', 'ASSET', 'DEBIT', v_parent_id, TRUE, TRUE
  )
  ON CONFLICT (org_id, code) DO UPDATE
  SET name = EXCLUDED.name,
      type = 'ASSET',
      normal_balance = 'DEBIT',
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_system = TRUE,
      is_active = TRUE,
      updated_at = NOW();

  INSERT INTO public.accounts (
    org_id, code, name, type, normal_balance, parent_id, is_system, is_active
  ) VALUES (
    p_org_id, '1304', 'Persediaan Barang Jadi', 'ASSET', 'DEBIT', v_parent_id, TRUE, TRUE
  )
  ON CONFLICT (org_id, code) DO UPDATE
  SET name = EXCLUDED.name,
      type = 'ASSET',
      normal_balance = 'DEBIT',
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_system = TRUE,
      is_active = TRUE,
      updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."ensure_inventory_segment_accounts"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_istishna_liability_account"("p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_liability_root_id UUID;
  v_syariah_liability_parent_id UUID;
  v_istishna_liability_id UUID;
BEGIN
  -- Get Liability Root (2000)
  SELECT id
  INTO v_liability_root_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '2000'
  LIMIT 1;

  IF v_liability_root_id IS NULL THEN
    SELECT id
    INTO v_liability_root_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND type = 'LIABILITY'
    ORDER BY code
    LIMIT 1;
  END IF;

  -- Ensure '2600' (Kewajiban Syariah)
  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '2600',
    'Kewajiban Syariah',
    'LIABILITY',
    'CREDIT',
    v_liability_root_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      normal_balance = EXCLUDED.normal_balance,
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_active = TRUE
  RETURNING id INTO v_syariah_liability_parent_id;

  IF v_syariah_liability_parent_id IS NULL THEN
    SELECT id
    INTO v_syariah_liability_parent_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '2600'
    LIMIT 1;
  END IF;

  -- Ensure '2603' (Hutang Istishna)
  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '2603',
    'Hutang Istishna',
    'LIABILITY',
    'CREDIT',
    v_syariah_liability_parent_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      normal_balance = EXCLUDED.normal_balance,
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_active = TRUE
  RETURNING id INTO v_istishna_liability_id;

  RETURN v_istishna_liability_id;
END;
$$;


ALTER FUNCTION "public"."ensure_istishna_liability_account"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_istishna_vendor_asset_account"("p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_asset_root_id UUID;
  v_istishna_asset_id UUID;
BEGIN
  SELECT id INTO v_asset_root_id FROM public.accounts WHERE org_id = p_org_id AND code = '1200' LIMIT 1;
  IF v_asset_root_id IS NULL THEN
    SELECT id INTO v_asset_root_id FROM public.accounts WHERE org_id = p_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id, code, name, type, normal_balance, parent_id, is_system, is_active
  )
  VALUES (
    p_org_id, '1205', 'Aset / Piutang Barang Istishna (Pembelian)', 'ASSET', 'DEBIT', v_asset_root_id, FALSE, TRUE
  )
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name, type = EXCLUDED.type, normal_balance = EXCLUDED.normal_balance, is_active = TRUE
  RETURNING id INTO v_istishna_asset_id;

  RETURN v_istishna_asset_id;
END;
$$;


ALTER FUNCTION "public"."ensure_istishna_vendor_asset_account"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_main_branch_for_org"("p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF to_regclass('public.branches') IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.branches (org_id, name, code, address, is_active)
  VALUES (p_org_id, 'Unit Utama', 'MAIN', NULL, TRUE)
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_branch_id;

  IF v_branch_id IS NOT NULL THEN
    RETURN v_branch_id;
  END IF;

  SELECT b.id
  INTO v_branch_id
  FROM public.branches b
  WHERE b.org_id = p_org_id
    AND (b.code = 'MAIN' OR b.name = 'Unit Utama')
  ORDER BY
    CASE WHEN b.code = 'MAIN' THEN 0 ELSE 1 END,
    b.created_at ASC,
    b.id ASC
  LIMIT 1;

  RETURN v_branch_id;
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."ensure_main_branch_for_org"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_salam_liability_account"("p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_liability_root_id UUID;
  v_syariah_liability_parent_id UUID;
  v_salam_liability_id UUID;
BEGIN
  SELECT id
  INTO v_liability_root_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '2000'
  LIMIT 1;

  IF v_liability_root_id IS NULL THEN
    SELECT id
    INTO v_liability_root_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND type = 'LIABILITY'
    ORDER BY code
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '2600',
    'Kewajiban Syariah',
    'LIABILITY',
    'CREDIT',
    v_liability_root_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      normal_balance = EXCLUDED.normal_balance,
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_active = TRUE
  RETURNING id INTO v_syariah_liability_parent_id;

  IF v_syariah_liability_parent_id IS NULL THEN
    SELECT id
    INTO v_syariah_liability_parent_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND code = '2600'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '2602',
    'Hutang Salam',
    'LIABILITY',
    'CREDIT',
    v_syariah_liability_parent_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      normal_balance = EXCLUDED.normal_balance,
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_active = TRUE
  RETURNING id INTO v_salam_liability_id;

  RETURN v_salam_liability_id;
END;
$$;


ALTER FUNCTION "public"."ensure_salam_liability_account"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_salam_vendor_receivable_account"("p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_asset_root_id UUID;
  v_salam_receivable_id UUID;
BEGIN
  SELECT id
  INTO v_asset_root_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = '1000'
  LIMIT 1;

  IF v_asset_root_id IS NULL THEN
    SELECT id
    INTO v_asset_root_id
    FROM public.accounts
    WHERE org_id = p_org_id
      AND type = 'ASSET'
    ORDER BY code
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (
    org_id,
    code,
    name,
    type,
    normal_balance,
    parent_id,
    is_system,
    is_active
  )
  VALUES (
    p_org_id,
    '1404',
    'Piutang Salam Vendor',
    'ASSET',
    'DEBIT',
    v_asset_root_id,
    FALSE,
    TRUE
  )
  ON CONFLICT (org_id, code)
  DO UPDATE
    SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      normal_balance = EXCLUDED.normal_balance,
      parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
      is_active = TRUE
  RETURNING id INTO v_salam_receivable_id;

  RETURN v_salam_receivable_id;
END;
$$;


ALTER FUNCTION "public"."ensure_salam_vendor_receivable_account"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fill_bsc_measurement_scores"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_target NUMERIC;
  v_direction TEXT;
  v_achievement NUMERIC;
  v_score_100 NUMERIC;
BEGIN
  SELECT k.target_value, k.direction
    INTO v_target, v_direction
  FROM public.bsc_kpis k
  WHERE k.id = NEW.kpi_id
    AND k.cycle_id = NEW.cycle_id
  LIMIT 1;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'KPI tidak ditemukan untuk measurement ini.';
  END IF;

  v_achievement := public.bsc_calculate_achievement_percent(NEW.actual_value, v_target, v_direction);
  v_score_100 := public.bsc_score_100_from_achievement(v_achievement);

  NEW.achievement_percent := ROUND(v_achievement::NUMERIC, 2);
  NEW.score_100 := ROUND(v_score_100::NUMERIC, 2);
  NEW.score_4 := public.bsc_score_4_from_score_100(v_score_100);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fill_bsc_measurement_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_entry_number"("p_org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_year  TEXT := TO_CHAR(NOW(), 'YYYY');
  v_count INT;
BEGIN
  -- Mencari angka terakhir dari format JE-XXXX-000001
  SELECT COALESCE(MAX(CAST(NULLIF(SUBSTRING(entry_number FROM 9), '') AS INT)), 0) + 1 
  INTO v_count
  FROM public.journal_entries
  WHERE org_id = p_org_id
    AND entry_number LIKE 'JE-' || v_year || '-%';

  RETURN 'JE-' || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
END;
$$;


ALTER FUNCTION "public"."generate_entry_number"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_inventory_adj_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_prefix TEXT := 'ADJ-';
    v_year TEXT := TO_CHAR(NOW(), 'YYYY');
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO v_count 
    FROM public.inventory_adjustments 
    WHERE org_id = NEW.org_id AND TO_CHAR(adj_date, 'YYYY') = v_year;
    
    NEW.adj_number := v_prefix || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_inventory_adj_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_payslips_for_run"("p_run_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_run RECORD;
    v_employee RECORD;
    v_component RECORD;
    v_payslip_id UUID;
    v_basic_salary NUMERIC;
    v_total_earnings NUMERIC := 0;
    v_total_deductions NUMERIC := 0;
    v_net_salary NUMERIC := 0;
    v_amount NUMERIC;
    v_basic_salary_account_id UUID;
    v_count INTEGER := 0;
BEGIN
    SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_run_id;
    
    IF v_run.org_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run not found.';
    END IF;

    IF v_run.branch_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run branch context is required.';
    END IF;

    IF v_run.status = 'PAID' THEN
        RAISE EXCEPTION 'Cannot re-generate slips for a PAID run.';
    END IF;

    DELETE FROM public.payslips WHERE run_id = p_run_id;

    SELECT id INTO v_basic_salary_account_id FROM public.accounts
    WHERE org_id = v_run.org_id AND code = '6001' LIMIT 1;
    
    IF v_basic_salary_account_id IS NULL THEN
        SELECT id INTO v_basic_salary_account_id FROM public.accounts
        WHERE org_id = v_run.org_id AND (code LIKE '6%' OR name ILIKE '%Beban Gaji%') LIMIT 1;
    END IF;

    FOR v_employee IN
        SELECT id, first_name, last_name, basic_salary, branch_id
        FROM public.employees
        WHERE org_id = v_run.org_id
          AND branch_id = v_run.branch_id
          AND employment_status NOT IN ('TERMINATED', 'RESIGNED')
    LOOP
        v_basic_salary := v_employee.basic_salary;
        v_total_earnings := 0;
        v_total_deductions := 0;

        INSERT INTO public.payslips (run_id, branch_id, employee_id, basic_salary, net_salary)
        VALUES (p_run_id, v_run.branch_id, v_employee.id, v_basic_salary, 0)
        RETURNING id INTO v_payslip_id;

        INSERT INTO public.payslip_lines (payslip_id, component_name, type, amount, account_id)
        VALUES (v_payslip_id, 'Gaji Pokok', 'EARNING', v_basic_salary, v_basic_salary_account_id);

        FOR v_component IN
            SELECT
                pc.id, pc.account_id, pc.name, pc.type,
                COALESCE(ec.amount, pc.default_amount) as amount,
                pc.is_percentage, pc.percentage_value
            FROM public.payroll_components pc
            LEFT JOIN public.employee_components ec ON pc.id = ec.component_id AND ec.employee_id = v_employee.id
            WHERE pc.org_id = v_run.org_id
              AND (ec.is_active IS TRUE OR ec.id IS NULL)
        LOOP
            IF v_component.is_percentage THEN
                v_amount := (v_component.percentage_value / 100.0) * v_basic_salary;
            ELSE
                v_amount := v_component.amount;
            END IF;

            INSERT INTO public.payslip_lines (payslip_id, component_id, account_id, component_name, type, amount)
            VALUES (v_payslip_id, v_component.id, v_component.account_id, v_component.name, v_component.type, v_amount);

            IF v_component.type IN ('EARNING', 'BENEFIT') THEN
                v_total_earnings := v_total_earnings + v_amount;
            ELSIF v_component.type IN ('DEDUCTION', 'TAX') THEN
                v_total_deductions := v_total_deductions + v_amount;
            END IF;
        END LOOP;

        v_net_salary := v_basic_salary + v_total_earnings - v_total_deductions;
        
        UPDATE public.payslips SET
            gross_salary = v_basic_salary + v_total_earnings,
            total_deductions = v_total_deductions,
            net_salary = v_net_salary
        WHERE id = v_payslip_id;

        v_count := v_count + 1;
    END LOOP;

    UPDATE public.payroll_runs SET
        total_gross = COALESCE((SELECT SUM(gross_salary) FROM public.payslips WHERE run_id = p_run_id), 0),
        total_deductions = COALESCE((SELECT SUM(total_deductions) FROM public.payslips WHERE run_id = p_run_id), 0),
        total_net = COALESCE((SELECT SUM(net_salary) FROM public.payslips WHERE run_id = p_run_id), 0)
    WHERE id = p_run_id;

    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."generate_payslips_for_run"("p_run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_support_ticket_no"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN 'TCK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
END;
$$;


ALTER FUNCTION "public"."generate_support_ticket_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_attendance_summary"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("total_days" integer, "present_days" integer, "late_days" integer, "absent_days" integer, "sick_days" integer, "leave_days" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (p_end_date - p_start_date + 1)::INTEGER,
        COUNT(*) FILTER (WHERE status = 'PRESENT')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'PRESENT' AND check_in > (record_date + interval '9 hours'))::INTEGER, 
        COUNT(*) FILTER (WHERE status = 'ABSENT')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'SICK')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'LEAVE')::INTEGER
    FROM attendance
    WHERE employee_id = p_employee_id
    AND record_date BETWEEN p_start_date AND p_end_date;
END;
$$;


ALTER FUNCTION "public"."get_attendance_summary"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_audit_logs_with_users"("p_org_id" "uuid") RETURNS TABLE("id" "uuid", "org_id" "uuid", "user_id" "uuid", "action" "text", "table_name" "text", "record_id" "uuid", "old_data" "jsonb", "new_data" "jsonb", "ip_address" "text", "user_agent" "text", "created_at" timestamp with time zone, "user_email" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    a.id, a.org_id, a.user_id, a.action, a.table_name, a.record_id, 
    a.old_data, a.new_data, a.ip_address, a.user_agent, a.created_at, 
    COALESCE(u.email, 'Sistem Auto') as user_email
  FROM public.audit_logs a
  LEFT JOIN auth.users u ON a.user_id = u.id
  WHERE a.org_id = p_org_id
  ORDER BY a.created_at DESC
  LIMIT 100;
$$;


ALTER FUNCTION "public"."get_audit_logs_with_users"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_budget_vs_actual"("p_org_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("account_code" "text", "account_name" "text", "account_type" "text", "budget_amount" numeric, "actual_amount" numeric, "variance" numeric, "variance_percent" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH actuals AS (
        SELECT 
            a.id as acc_id,
            a.code as acc_code,
            a.name as acc_name,
            a.type as acc_type,
            SUM(CASE 
                WHEN a.normal_balance = 'DEBIT' THEN (jl.debit - jl.credit)
                ELSE (jl.credit - jl.debit)
            END) as actual_val
        FROM accounts a
        LEFT JOIN journal_lines jl ON jl.account_id = a.id
        LEFT JOIN journal_entries je ON je.id = jl.entry_id
        WHERE a.org_id = p_org_id
        AND je.status = 'POSTED'
        AND je.entry_date BETWEEN p_start_date AND p_end_date
        GROUP BY a.id, a.code, a.name, a.type
    ),
    budget_agg AS (
        SELECT 
            account_id,
            SUM(budget_amount) as total_budget
        FROM budgets
        WHERE org_id = p_org_id
        AND period BETWEEN p_start_date AND p_end_date
        GROUP BY account_id
    )
    SELECT 
        act.acc_code,
        act.acc_name,
        act.acc_type,
        COALESCE(b.total_budget, 0)::DECIMAL(19,4) as budget_amount,
        COALESCE(act.actual_val, 0)::DECIMAL(19,4) as actual_amount,
        (COALESCE(act.actual_val, 0) - COALESCE(b.total_budget, 0))::DECIMAL(19,4) as variance,
        CASE 
            WHEN COALESCE(b.total_budget, 0) = 0 THEN 
                CASE WHEN COALESCE(act.actual_val, 0) = 0 THEN 0 ELSE 100 END
            ELSE ( (COALESCE(act.actual_val, 0) - b.total_budget) / ABS(b.total_budget) * 100 )::DECIMAL(10,2)
        END as variance_percent
    FROM actuals act
    LEFT JOIN budget_agg b ON b.account_id = act.acc_id
    WHERE COALESCE(b.total_budget, 0) != 0 OR COALESCE(act.actual_val, 0) != 0
    ORDER BY act.acc_code;
END;
$$;


ALTER FUNCTION "public"."get_budget_vs_actual"("p_org_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_consolidated_org_hierarchy"("p_parent_org_id" "uuid") RETURNS TABLE("org_id" "uuid", "parent_org_id" "uuid", "org_name" "text", "level_depth" integer, "hierarchy_label" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH parent_and_direct_children AS (
        SELECT
            o.id,
            o.parent_org_id,
            o.name,
            0::INT AS level_depth,
            0::INT AS sort_group,
            LOWER(o.name) AS sort_name
        FROM organizations o
        WHERE o.id = p_parent_org_id

        UNION ALL

        SELECT
            c.id,
            c.parent_org_id,
            c.name,
            1::INT AS level_depth,
            1::INT AS sort_group,
            LOWER(c.name) AS sort_name
        FROM organizations c
        WHERE c.parent_org_id = p_parent_org_id
    )
    SELECT
        id AS org_id,
        parent_org_id,
        name AS org_name,
        level_depth,
        CASE
            WHEN level_depth = 0 THEN name || ' (Parent)'
            ELSE '  |__> ' || name
        END AS hierarchy_label
    FROM parent_and_direct_children
    ORDER BY sort_group, sort_name;
$$;


ALTER FUNCTION "public"."get_consolidated_org_hierarchy"("p_parent_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_consolidated_org_ids"("p_parent_org_id" "uuid") RETURNS TABLE("org_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH RECURSIVE org_tree AS (
        -- Base case: The parent organization
        SELECT id
        FROM organizations
        WHERE id = p_parent_org_id

        UNION ALL

        -- Recursive case: Find all organizations where parent is in the current tree
        SELECT o.id
        FROM organizations o
        INNER JOIN org_tree ot ON o.parent_org_id = ot.id
    )
    SELECT id FROM org_tree;
$$;


ALTER FUNCTION "public"."get_consolidated_org_ids"("p_parent_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_default_branch_id"("p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT b.id
  FROM public.branches b
  WHERE b.org_id = p_org_id
  ORDER BY
    CASE
      WHEN b.is_active = TRUE AND (b.code = 'MAIN' OR b.name = 'Unit Utama') THEN 0
      WHEN b.is_active = TRUE THEN 1
      WHEN b.code = 'MAIN' OR b.name = 'Unit Utama' THEN 2
      ELSE 3
    END,
    b.created_at ASC,
    b.id ASC
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_default_branch_id"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_org_ids"() RETURNS TABLE("org_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = TRUE;
$$;


ALTER FUNCTION "public"."get_my_org_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_org_ids_v3"() RETURNS TABLE("org_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = TRUE;
$$;


ALTER FUNCTION "public"."get_my_org_ids_v3"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_sales_non_salam_stock_after_delivery"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_item RECORD;
  v_stock_after NUMERIC;
BEGIN
  -- Guard only when status transitions into FINISHED.
  IF NEW.status IS DISTINCT FROM 'FINISHED' OR OLD.status = 'FINISHED' THEN
    RETURN NEW;
  END IF;

  -- Akad SALAM is explicitly allowed to exceed on-hand stock.
  IF UPPER(COALESCE(NEW.shariah_mode::TEXT, 'CASH')) = 'SALAM' THEN
    RETURN NEW;
  END IF;

  IF NEW.warehouse_id IS NULL THEN
    RAISE EXCEPTION
      'Gudang pengiriman wajib dipilih. Penjualan tidak boleh melebihi stok (kecuali akad SALAM).';
  END IF;

  FOR v_item IN
    SELECT
      si.product_id,
      COALESCE(MAX(p.name), MAX(si.description), si.product_id::TEXT) AS product_name
    FROM public.sales_items si
    LEFT JOIN public.products p ON p.id = si.product_id
    WHERE si.org_id = NEW.org_id
      AND si.sale_id = NEW.id
      AND COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
    GROUP BY si.product_id
  LOOP
    SELECT COALESCE(SUM(s.quantity), 0)
    INTO v_stock_after
    FROM public.inventory_stocks s
    WHERE s.org_id = NEW.org_id
      AND s.warehouse_id = NEW.warehouse_id
      AND s.product_id = v_item.product_id;

    IF v_stock_after < -0.000001 THEN
      RAISE EXCEPTION
        'Stok produk "%" tidak cukup. Penjualan tidak boleh melebihi stok (kecuali akad SALAM). Sisa stok setelah pengiriman: %.',
        v_item.product_name,
        v_stock_after;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_sales_non_salam_stock_after_delivery"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inject_shariah_coa"("org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_liab_shariah_id UUID;
  v_ijarah_id UUID;
  v_zakat_id UUID;
  v_equity_parent UUID;
  v_liab_parent UUID;
  v_expense_parent UUID;
  v_asset_parent UUID;
BEGIN
  -- Parent roots
  SELECT id INTO v_asset_parent   FROM public.accounts WHERE org_id = inject_shariah_coa.org_id AND code = '1000' LIMIT 1;
  SELECT id INTO v_equity_parent  FROM public.accounts WHERE org_id = inject_shariah_coa.org_id AND code = '3000' LIMIT 1;
  SELECT id INTO v_liab_parent    FROM public.accounts WHERE org_id = inject_shariah_coa.org_id AND code = '2000' LIMIT 1;
  SELECT id INTO v_expense_parent FROM public.accounts WHERE org_id = inject_shariah_coa.org_id AND code = '6000' LIMIT 1;

  -- Cleanup legacy equity parent 3100 only (no longer part of CoAS activation)
  UPDATE public.accounts
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE org_id = inject_shariah_coa.org_id
    AND code = '3100';

  -- Keep Syirkah children as active accounts directly under 3000.
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (inject_shariah_coa.org_id, '3110', 'Modal Syirkah Mudharabah', 'EQUITY', 'CREDIT', v_equity_parent, FALSE, TRUE),
    (inject_shariah_coa.org_id, '3120', 'Modal Syirkah Inan', 'EQUITY', 'CREDIT', v_equity_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(EXCLUDED.parent_id, public.accounts.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  -- 1. LIABILITIES (QARD / SALAM)
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (inject_shariah_coa.org_id, '2600', 'Kewajiban Syariah', 'LIABILITY', 'CREDIT', v_liab_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_liab_shariah_id;

  IF v_liab_shariah_id IS NULL THEN
    SELECT id INTO v_liab_shariah_id
    FROM public.accounts
    WHERE org_id = inject_shariah_coa.org_id
      AND code = '2600'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (inject_shariah_coa.org_id, '2601', 'Hutang Qard (Kebajikan)', 'LIABILITY', 'CREDIT', v_liab_shariah_id, FALSE, TRUE),
    (inject_shariah_coa.org_id, '2602', 'Hutang Salam', 'LIABILITY', 'CREDIT', v_liab_shariah_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  -- 1b. SALAM receivable
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (inject_shariah_coa.org_id, '1404', 'Piutang Salam Vendor', 'ASSET', 'DEBIT', v_asset_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  -- 2. IJARAH (EXPENSES)
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (inject_shariah_coa.org_id, '6100', 'Beban Ijarah & Ujrah', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_ijarah_id;

  IF v_ijarah_id IS NULL THEN
    SELECT id INTO v_ijarah_id
    FROM public.accounts
    WHERE org_id = inject_shariah_coa.org_id
      AND code = '6100'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (inject_shariah_coa.org_id, '6110', 'Beban Ujrah Gaji', 'EXPENSE', 'DEBIT', v_ijarah_id, FALSE, TRUE),
    (inject_shariah_coa.org_id, '6120', 'Beban Ujrah Sewa & Lainnya', 'EXPENSE', 'DEBIT', v_ijarah_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();

  -- 3. ZAKAT & SOSIAL (EXPENSES)
  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES (inject_shariah_coa.org_id, '6200', 'Beban Zakat & Sosial', 'EXPENSE', 'DEBIT', v_expense_parent, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW()
  RETURNING id INTO v_zakat_id;

  IF v_zakat_id IS NULL THEN
    SELECT id INTO v_zakat_id
    FROM public.accounts
    WHERE org_id = inject_shariah_coa.org_id
      AND code = '6200'
    LIMIT 1;
  END IF;

  INSERT INTO public.accounts (org_id, code, name, type, normal_balance, parent_id, is_system, is_active)
  VALUES
    (inject_shariah_coa.org_id, '6210', 'Zakat Maal Pemilik', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE),
    (inject_shariah_coa.org_id, '6220', 'Zakat Tijarah (Perdagangan)', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE),
    (inject_shariah_coa.org_id, '6230', 'Cukai Mu''ahidah', 'EXPENSE', 'DEBIT', v_zakat_id, FALSE, TRUE)
  ON CONFLICT (org_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        parent_id = COALESCE(public.accounts.parent_id, EXCLUDED.parent_id),
        is_active = TRUE,
        updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."inject_shariah_coa"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_main_organization"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_org_id
      AND o.parent_org_id IS NULL
  );
$$;


ALTER FUNCTION "public"."is_main_organization"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_admin"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id AND user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
  );
$$;


ALTER FUNCTION "public"."is_org_admin"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_admin_v3"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = TRUE
  );
$$;


ALTER FUNCTION "public"."is_org_admin_v3"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_in_consolidation_tree"("p_target_org_id" "uuid", "p_parent_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.get_consolidated_org_ids(p_parent_org_id)
        WHERE org_id = p_target_org_id
    );
$$;


ALTER FUNCTION "public"."is_org_in_consolidation_tree"("p_target_org_id" "uuid", "p_parent_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email') IN ('bob@executive.id')
    OR (auth.jwt() ->> 'email') LIKE '%@nizam.id'
    OR (auth.jwt() ->> 'email') LIKE '%@executive.id',
    FALSE
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.org_id;
    ELSE
        v_org_id := NEW.org_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, new_data)
        VALUES (v_org_id, v_user_id, 'CREATE', TG_TABLE_NAME, NEW.id, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF row_to_json(OLD)::jsonb = row_to_json(NEW)::jsonb THEN
            RETURN NEW;
        END IF;

        -- MEMBACA JSON DENGAN CERDAS (Mencegah error 'no field status')
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
$$;


ALTER FUNCTION "public"."log_audit_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nizam_has_permission"("p_permission" "text", "p_org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_role member_role;
  v_custom_role_id UUID;
BEGIN
  -- Ambil Role sistem (admin/staff) dan Role Kustom (Jabatan)
  SELECT role, role_id INTO v_role, v_custom_role_id
  FROM org_members
  WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND is_active = TRUE
  LIMIT 1;

  -- Owner & Admin selalu punya akses penuh (Superuser)
  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Jika ada Jabatan kustom yang diberikan, cek izin di tabel roles
  IF v_custom_role_id IS NOT NULL THEN
     RETURN EXISTS (
       SELECT 1 FROM roles r
       WHERE r.id = v_custom_role_id
         AND p_permission = ANY(r.permissions)
     );
  END IF;

  -- Fallback: Cek izin standar jika tidak ada jabatan kustom spesifik
  RETURN EXISTS (
    SELECT 1 FROM roles r
    JOIN org_members om ON om.org_id = r.org_id
    WHERE om.user_id = auth.uid()
      AND r.name = (CASE 
          WHEN v_role = 'manager' THEN 'Manager' 
          WHEN v_role = 'staff' THEN 'Staff' 
          WHEN v_role = 'viewer' THEN 'Viewer' 
          ELSE NULL 
        END)
      AND r.org_id = p_org_id
      AND p_permission = ANY(r.permissions)
      AND om.is_active = TRUE
  );
END;
$$;


ALTER FUNCTION "public"."nizam_has_permission"("p_permission" "text", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_measurement_unit"("p_unit" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_unit TEXT := lower(trim(COALESCE(p_unit, '')));
BEGIN
  v_unit := regexp_replace(v_unit, '\s+', '', 'g');
  v_unit := replace(v_unit, '.', '');

  IF v_unit = '' THEN
    RETURN '';
  END IF;

  IF v_unit IN ('kg', 'kilo', 'kilogram') THEN
    RETURN 'kg';
  ELSIF v_unit IN ('g', 'gr', 'gram', 'grams') THEN
    RETURN 'gram';
  ELSIF v_unit IN ('l', 'lt', 'ltr', 'liter', 'litre') THEN
    RETURN 'liter';
  ELSIF v_unit IN ('ml', 'milliliter', 'millilitre', 'cc') THEN
    RETURN 'ml';
  ELSIF v_unit IN ('m', 'meter', 'metre') THEN
    RETURN 'meter';
  ELSIF v_unit IN ('cm', 'centimeter', 'centimetre') THEN
    RETURN 'cm';
  ELSIF v_unit IN ('pcs', 'pc', 'piece', 'pieces') THEN
    RETURN 'pcs';
  ELSIF v_unit IN ('unit', 'units', 'satuan') THEN
    RETURN 'unit';
  END IF;

  RETURN v_unit;
END;
$$;


ALTER FUNCTION "public"."normalize_measurement_unit"("p_unit" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_overlapping_fleet_bookings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.end_date <= NEW.start_date THEN
    RAISE EXCEPTION 'Tanggal selesai harus lebih besar dari tanggal mulai.';
  END IF;

  IF NEW.status <> 'CANCELLED'
    AND EXISTS (
      SELECT 1
      FROM public.fleet_bookings existing_booking
      WHERE existing_booking.org_id = NEW.org_id
        AND existing_booking.asset_id = NEW.asset_id
        AND existing_booking.status <> 'CANCELLED'
        AND existing_booking.start_date < NEW.end_date
        AND existing_booking.end_date > NEW.start_date
        AND (TG_OP = 'INSERT' OR existing_booking.id <> NEW.id)
    ) THEN
    RAISE EXCEPTION 'Armada sudah memiliki booking aktif di periode tersebut.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_overlapping_fleet_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_asset_disposal"("p_org_id" "uuid", "p_asset_id" "uuid", "p_sale_price" numeric, "p_sale_date" "date", "p_cash_account_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_asset RECORD;
    v_je_id UUID;
    v_book_value DECIMAL;
    v_gain_loss DECIMAL;
    acc_gain UUID;
    acc_loss UUID;
BEGIN
    SELECT * INTO v_asset FROM public.fixed_assets WHERE id = p_asset_id AND org_id = p_org_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aset tidak ditemukan.');
    END IF;
    IF v_asset.status = 'DISPOSED' OR v_asset.status = 'SOLD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Aset ini sudah pernah dilepas/dijual sebelumnya.');
    END IF;

    v_book_value := COALESCE(v_asset.current_book_value, 0);
    v_gain_loss := p_sale_price - v_book_value;

    SELECT id INTO acc_gain FROM public.accounts WHERE org_id = p_org_id AND code = '7001' LIMIT 1;
    SELECT id INTO acc_loss FROM public.accounts WHERE org_id = p_org_id AND code = '7002' LIMIT 1;

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

    INSERT INTO public.journal_entries (org_id, branch_id, entry_date, description, reference_type, reference_id, status)
    VALUES (
        p_org_id,
        v_asset.branch_id,
        p_sale_date,
        COALESCE(p_notes, 'Pelepasan Aset: ' || v_asset.name),
        'ADJUSTMENT',
        p_asset_id,
        'POSTED'
    )
    RETURNING id INTO v_je_id;

    IF COALESCE(v_asset.accumulated_depreciation, 0) > 0 AND v_asset.accum_dep_account_id IS NOT NULL THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, v_asset.accum_dep_account_id, v_asset.accumulated_depreciation, 0);
    END IF;

    IF p_sale_price > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, p_cash_account_id, p_sale_price, 0);
    END IF;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_asset.asset_account_id, 0, v_asset.purchase_price);

    IF v_gain_loss > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, acc_gain, 0, v_gain_loss);
    ELSIF v_gain_loss < 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, acc_loss, ABS(v_gain_loss), 0);
    END IF;

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


ALTER FUNCTION "public"."process_asset_disposal"("p_org_id" "uuid", "p_asset_id" "uuid", "p_sale_price" numeric, "p_sale_date" "date", "p_cash_account_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_expense_claim"("p_claim_id" "uuid", "p_approved_by" "uuid", "p_expense_account_id" "uuid", "p_payable_account_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_claim RECORD;
    v_je_id UUID;
BEGIN
    SELECT * INTO v_claim FROM public.expense_claims WHERE id = p_claim_id;
    
    IF v_claim.status != 'PENDING' THEN
        RAISE EXCEPTION 'Claim already processed.';
    END IF;

    INSERT INTO public.journal_entries (
        org_id,
        branch_id,
        entry_date,
        description,
        reference_type,
        reference_id,
        status,
        is_auto,
        created_by
    ) VALUES (
        v_claim.org_id,
        v_claim.branch_id,
        v_claim.claim_date,
        'Reimbursement: ' || v_claim.description,
        'EMPLOYEE_EXPENSE',
        v_claim.id,
        'POSTED',
        TRUE,
        p_approved_by
    ) RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, p_expense_account_id, v_claim.amount, 0, v_claim.description);
    
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, p_payable_account_id, 0, v_claim.amount, 'Payable to employee: ' || v_claim.employee_id);

    UPDATE public.expense_claims SET 
        status = 'APPROVED',
        approved_by = p_approved_by,
        journal_entry_id = v_je_id,
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN v_je_id;
END;
$$;


ALTER FUNCTION "public"."process_expense_claim"("p_claim_id" "uuid", "p_approved_by" "uuid", "p_expense_account_id" "uuid", "p_payable_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_adj RECORD;
    v_item RECORD;
    v_je_id UUID;
    v_loss_account_id UUID;
    v_inv_account_id UUID;
    v_target_asset_account UUID;
    v_product_asset_account UUID;
BEGIN
    -- A. Ambil Info Adjustment
    SELECT * INTO v_adj FROM public.inventory_adjustments WHERE id = p_adj_id;
    IF v_adj.status != 'DRAFT' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Adjustment sudah pernah diproses.');
    END IF;

    -- B. Ambil Akun-Akun Penting dengan Fallback
    -- Cari Akun Kerugian (6011 -> 6099 -> 6000)
    SELECT id INTO v_loss_account_id FROM public.accounts WHERE org_id = v_adj.org_id AND code = '6011';
    IF v_loss_account_id IS NULL THEN
        SELECT id INTO v_loss_account_id FROM public.accounts WHERE org_id = v_adj.org_id AND code = '6099';
    END IF;
    IF v_loss_account_id IS NULL THEN
        SELECT id INTO v_loss_account_id FROM public.accounts WHERE org_id = v_adj.org_id AND (code = '6000' OR code = '5001');
    END IF;

    -- Cari Akun Persediaan Global (1301 - Default Fallback)
    SELECT id INTO v_inv_account_id FROM public.accounts WHERE org_id = v_adj.org_id AND code = '1301';

    -- Validasi Akun Kerugian (Wajib ada)
    IF v_loss_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Kerugian Persediaan (6011/6099) belum terdaftar di COA.');
    END IF;

    -- C. Buat Header Jurnal
    INSERT INTO public.journal_entries (
        org_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_adj.org_id, v_adj.adj_date, 
        'Inventory Adjustment: ' || v_adj.adj_number || ' (' || v_adj.type::text || ')',
        'INVENTORY_ADJ', v_adj.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    -- D. Proses Tiap Item
    FOR v_item IN SELECT * FROM public.inventory_adjustment_items WHERE adjustment_id = p_adj_id LOOP
        -- Ambil akun aset khusus produk (jika di-set)
        SELECT asset_account_id INTO v_product_asset_account FROM public.products WHERE id = v_item.product_id;
        
        -- Fallback ke akun 1301 jika produk tidak memiliki mapping akun sendiri
        v_target_asset_account := COALESCE(v_product_asset_account, v_inv_account_id);

        IF v_target_asset_account IS NULL THEN
            RAISE EXCEPTION 'Produk tidak memiliki mapping akun persediaan dan akun default 1301 tidak ditemukan di COA.';
        END IF;

        -- 1. Insert Stock Movement (Kartu Stok)
        INSERT INTO public.stock_movements (
            org_id, product_id, quantity, unit_price, 
            reference_type, reference_id, notes
        ) VALUES (
            v_adj.org_id, v_item.product_id, v_item.diff_quantity, v_item.unit_cost,
            'ADJUSTMENT', v_adj.id, v_item.notes
        );

        -- 2. Update Persediaan Fisik (Master Stok)
        IF v_item.warehouse_id IS NOT NULL THEN
            INSERT INTO public.inventory_stocks (org_id, product_id, warehouse_id, quantity)
            VALUES (v_adj.org_id, v_item.product_id, v_item.warehouse_id, v_item.diff_quantity)
            ON CONFLICT (product_id, warehouse_id, batch_number) DO UPDATE
            SET quantity = inventory_stocks.quantity + EXCLUDED.quantity,
                updated_at = NOW();
        END IF;

        -- 3. Isi Jurnal (Debit/Credit)
        IF v_item.diff_quantity < 0 THEN
            -- Write-off: (D) Kerugian, (C) Persediaan
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_loss_account_id, v_item.total_value, 0, 'Beban Kerugian Persediaan');
            
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_target_asset_account, 0, v_item.total_value, 'Write-off Stok: ' || v_adj.adj_number);
        ELSE
            -- Adjustment In: (D) Persediaan, (C) Akun Penyesuaian/Hasil Lainnya
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_target_asset_account, v_item.total_value, 0, 'Koreksi Stok (Inbound)');
            
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_loss_account_id, 0, v_item.total_value, 'Penyesuaian Nilai Stok');
        END IF;
    END LOOP;

    -- E. Update Status Dokumen
    UPDATE public.inventory_adjustments SET 
        status = 'FINISHED', 
        journal_entry_id = v_je_id 
    WHERE id = p_adj_id;

    RETURN jsonb_build_object('success', TRUE, 'adj_id', p_adj_id);
END;
$$;


ALTER FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_org_id" "uuid", "p_created_by" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_adj_item RECORD;
    v_total_value DECIMAL(15,2) := 0;
    v_journal_id UUID;
    v_loss_acc UUID;
    v_asset_acc UUID;
BEGIN
    -- 1. Ambil Akun Biaya Kerugian (6011)
    SELECT id INTO v_loss_acc FROM "public"."accounts" WHERE code = '6011' AND org_id = p_org_id;
    
    -- 2. Buat Header Jurnal (Uang)
    INSERT INTO "public"."journal_entries" (org_id, entry_date, description, created_by, status)
    VALUES (p_org_id, NOW(), 'Inventory Adjustment Write-off', p_created_by, 'POSTED')
    RETURNING id INTO v_journal_id;

    -- 3. Loop Barang & Catat Stok (Barang)
    FOR v_adj_item IN (SELECT * FROM "public"."inventory_adjustment_items" WHERE adjustment_id = p_adj_id) LOOP
        v_total_value := v_total_value + (ABS(v_adj_item.diff_quantity) * v_adj_item.unit_cost);
        
        INSERT INTO "public"."stock_movements" (org_id, product_id, quantity, unit_price, reference_type, reference_id, notes)
        VALUES (p_org_id, v_adj_item.product_id, v_adj_item.diff_quantity, v_adj_item.unit_cost, 'ADJUSTMENT', p_adj_id, 'Write-off Resmi');
        
        -- Cari akun aset dari produk
        SELECT asset_account_id INTO v_asset_acc FROM "public"."products" WHERE id = v_adj_item.product_id;
    END LOOP;

    -- 4. Catat Baris Jurnal (Gunakan entry_id agar Neraca BALANCE)
    IF v_total_value > 0 THEN
        -- Debet Kerugian
        INSERT INTO "public"."journal_lines" (entry_id, account_id, debit, credit)
        VALUES (v_journal_id, v_loss_acc, v_total_value, 0);
        
        -- Kredit Persediaan
        INSERT INTO "public"."journal_lines" (entry_id, account_id, debit, credit)
        VALUES (v_journal_id, v_asset_acc, 0, v_total_value);
    END IF;

    UPDATE "public"."inventory_adjustments" SET status = 'COMPLETED' WHERE id = p_adj_id;
    RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_org_id" "uuid", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_inventory_transfer"("p_transfer_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_trf RECORD;
  v_item RECORD;
BEGIN
  SELECT *
    INTO v_trf
    FROM public.inventory_transfers
   WHERE id = p_transfer_id;

  IF v_trf.status != 'DRAFT' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Transfer already processed.');
  END IF;

  IF v_trf.source_wh_id = v_trf.target_wh_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Source and Target warehouses must be different.');
  END IF;

  FOR v_item IN
    SELECT *
      FROM public.inventory_transfer_items
     WHERE transfer_id = p_transfer_id
  LOOP
    INSERT INTO public.inventory_stocks (org_id, product_id, warehouse_id, quantity)
    VALUES (v_trf.org_id, v_item.product_id, v_trf.source_wh_id, -v_item.quantity)
    ON CONFLICT (product_id, warehouse_id, batch_number)
    DO UPDATE
      SET quantity = public.inventory_stocks.quantity - v_item.quantity,
          updated_at = NOW();

    INSERT INTO public.inventory_stocks (org_id, product_id, warehouse_id, quantity)
    VALUES (v_trf.org_id, v_item.product_id, v_trf.target_wh_id, v_item.quantity)
    ON CONFLICT (product_id, warehouse_id, batch_number)
    DO UPDATE
      SET quantity = public.inventory_stocks.quantity + v_item.quantity,
          updated_at = NOW();

    INSERT INTO public.stock_movements (
      org_id,
      product_id,
      movement_date,
      quantity,
      reference_type,
      reference_id,
      notes
    ) VALUES (
      v_trf.org_id,
      v_item.product_id,
      v_trf.transfer_date,
      -v_item.quantity,
      'TRANSFER_OUT',
      v_trf.id,
      'Transfer ke ' || (SELECT name FROM public.warehouses WHERE id = v_trf.target_wh_id)
    );

    INSERT INTO public.stock_movements (
      org_id,
      product_id,
      movement_date,
      quantity,
      reference_type,
      reference_id,
      notes
    ) VALUES (
      v_trf.org_id,
      v_item.product_id,
      v_trf.transfer_date,
      v_item.quantity,
      'TRANSFER_IN',
      v_trf.id,
      'Transfer dari ' || (SELECT name FROM public.warehouses WHERE id = v_trf.source_wh_id)
    );
  END LOOP;

  UPDATE public.inventory_transfers
     SET status = 'FINISHED'
   WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', TRUE, 'transfer_id', p_transfer_id);
END;
$$;


ALTER FUNCTION "public"."process_inventory_transfer"("p_transfer_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_payroll_payment"("p_run_id" "uuid", "p_bank_account_id" "uuid", "p_created_by" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_run RECORD;
    v_je_id UUID;
    v_line RECORD;
    v_bank_acc_id UUID;
BEGIN
    SELECT * INTO v_run FROM public.payroll_runs WHERE id = p_run_id;
    IF v_run.status = 'PAID' THEN
        RAISE EXCEPTION 'Payroll periode ini sudah diproses pembayarannya.';
    END IF;

    IF v_run.branch_id IS NULL THEN
        RAISE EXCEPTION 'Payroll run branch context is required.';
    END IF;

    v_bank_acc_id := COALESCE(v_run.disbursement_account_id, p_bank_account_id);
    
    IF v_bank_acc_id IS NULL THEN
        RAISE EXCEPTION 'Akun bank pembayaran tidak ditemukan. Harap pilih akun bank sumber dana.';
    END IF;

    INSERT INTO public.journal_entries (
        org_id,
        branch_id,
        entry_date,
        description,
        reference_type,
        reference_id,
        status,
        is_auto,
        created_by
    ) VALUES (
        v_run.org_id,
        v_run.branch_id,
        v_run.payment_date,
        'Payroll Disbursement: Periode ' || v_run.period_start::text || ' s/d ' || v_run.period_end::text,
        'PAYROLL',
        v_run.id,
        'POSTED',
        TRUE,
        p_created_by
    ) RETURNING id INTO v_je_id;

    FOR v_line IN
        SELECT
            account_id,
            SUM(CASE WHEN type IN ('EARNING', 'BENEFIT') THEN amount ELSE 0 END) as total_debit,
            SUM(CASE WHEN type IN ('DEDUCTION', 'TAX') THEN amount ELSE 0 END) as total_credit
        FROM public.payslip_lines
        WHERE payslip_id IN (SELECT id FROM public.payslips WHERE run_id = p_run_id)
          AND account_id IS NOT NULL
        GROUP BY account_id
    LOOP
        IF v_line.total_debit > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_line.account_id, v_line.total_debit, 0, 'Beban Gaji & Komponen');
        END IF;

        IF v_line.total_credit > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_line.account_id, 0, v_line.total_credit, 'Potongan/Pajak Gaji');
        END IF;
    END LOOP;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
    VALUES (v_je_id, v_bank_acc_id, 0, v_run.total_net, 'Payroll Net Salary Transfer');

    UPDATE public.payroll_runs SET
        status = 'PAID',
        journal_entry_id = v_je_id,
        disbursement_account_id = v_bank_acc_id
    WHERE id = p_run_id;
    
    UPDATE public.payslips SET payment_status = 'PAID' WHERE run_id = p_run_id;

    RETURN v_je_id;
END;
$$;


ALTER FUNCTION "public"."process_payroll_payment"("p_run_id" "uuid", "p_bank_account_id" "uuid", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_purchase_atomic"("p_org_id" "uuid", "p_vendor_id" "uuid", "p_date" timestamp with time zone, "p_due_date" "date", "p_total" numeric, "p_tax" numeric, "p_shipping" numeric, "p_grand_total" numeric, "p_notes" "text", "p_lines" "jsonb", "p_user_id" "uuid", "p_branch_id" "uuid" DEFAULT NULL::"uuid", "p_shariah_mode" "text" DEFAULT 'CASH'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_purchase_id UUID;
    v_line        RECORD;
    v_branch_exists BOOLEAN;
    v_shariah_mode TEXT;
BEGIN
    v_shariah_mode := UPPER(COALESCE(TRIM(p_shariah_mode), 'CASH'));

    IF v_shariah_mode = 'SALAM' AND p_due_date IS NULL THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Akad SALAM pembelian wajib menetapkan tanggal barang disediakan.'
      );
    END IF;

    IF p_branch_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.branches
            WHERE id = p_branch_id
              AND org_id = p_org_id
              AND is_active = TRUE
        ) INTO v_branch_exists;

        IF NOT v_branch_exists THEN
            RAISE EXCEPTION 'Branch % is not part of organization %', p_branch_id, p_org_id;
        END IF;
    END IF;

    INSERT INTO public.purchases (
        org_id, branch_id, vendor_id, purchase_date, due_date,
        total_amount, tax_amount, shipping_amount, grand_total,
        status, created_by, notes, shariah_mode
    ) VALUES (
        p_org_id, p_branch_id, p_vendor_id, p_date, p_due_date,
        p_total, p_tax, p_shipping, p_grand_total,
        'ORDERED', p_user_id, p_notes,
        (CASE v_shariah_mode
            WHEN 'SALAM'    THEN 'SALAM'
            WHEN 'ISTISHNA' THEN 'ISTISHNA'
            ELSE                 'CASH'
         END)::shariah_mode
    ) RETURNING id INTO v_purchase_id;

    FOR v_line IN
        SELECT * FROM jsonb_to_recordset(p_lines) AS x(
            product_id      UUID,
            description     TEXT,
            quantity        NUMERIC,
            unit_price      NUMERIC,
            discount_amount NUMERIC,
            tax_amount      NUMERIC
        )
    LOOP
        INSERT INTO public.purchase_items (
            org_id, purchase_id, product_id, description,
            quantity, unit_price, discount_amount, tax_amount
        ) VALUES (
            p_org_id, v_purchase_id, v_line.product_id, v_line.description,
            v_line.quantity, v_line.unit_price,
            COALESCE(v_line.discount_amount, 0),
            COALESCE(v_line.tax_amount, 0)
        );
    END LOOP;

    INSERT INTO public.approval_requests (
        org_id, requester_id, source_type, source_id, status, reason
    ) VALUES (
        p_org_id, p_user_id, 'PURCHASE_ORDER', v_purchase_id, 'PENDING',
        'Atomic Purchase Order (' || v_shariah_mode || ')'
    );

    RETURN jsonb_build_object('success', TRUE, 'purchase_id', v_purchase_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."process_purchase_atomic"("p_org_id" "uuid", "p_vendor_id" "uuid", "p_date" timestamp with time zone, "p_due_date" "date", "p_total" numeric, "p_tax" numeric, "p_shipping" numeric, "p_grand_total" numeric, "p_notes" "text", "p_lines" "jsonb", "p_user_id" "uuid", "p_branch_id" "uuid", "p_shariah_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_purchase_payment_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_payment_id UUID;
    v_payment_number TEXT;
    v_je_id UUID;
    v_total_invoice DECIMAL;
    v_total_returned DECIMAL;
    v_total_paid DECIMAL;
    v_remaining_ap DECIMAL;
    v_count INT;
    v_purchase RECORD;
    v_is_salam BOOLEAN := FALSE;
    v_is_istishna BOOLEAN := FALSE;
    v_debit_account_id UUID;
    acc_hutang UUID;
    acc_potongan UUID;
    v_cash_total_debit DECIMAL;
    v_cash_total_credit DECIMAL;
    v_cash_balance DECIMAL;
    v_journal_desc TEXT;
BEGIN
    SELECT id INTO acc_hutang FROM public.accounts WHERE code = '2101' AND org_id = p_org_id;
    SELECT id INTO acc_potongan FROM public.accounts WHERE code = '5004' AND org_id = p_org_id;

    SELECT id, branch_id, grand_total, shariah_mode
    INTO v_purchase
    FROM public.purchases
    WHERE id = p_purchase_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invoice pembelian tidak ditemukan.');
    END IF;

    v_is_salam := UPPER(COALESCE(v_purchase.shariah_mode::TEXT, 'CASH')) = 'SALAM';
    v_is_istishna := UPPER(COALESCE(v_purchase.shariah_mode::TEXT, 'CASH')) = 'ISTISHNA';

    IF v_is_salam THEN
      v_debit_account_id := public.ensure_salam_vendor_receivable_account(p_org_id);
      IF v_debit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang Salam Vendor (1404) belum tersedia di CoA.');
      END IF;
    ELSIF v_is_istishna THEN
      v_debit_account_id := public.ensure_istishna_vendor_asset_account(p_org_id);
      IF v_debit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Aset Barang Istishna (1205) belum tersedia di CoA.');
      END IF;
    ELSE
      v_debit_account_id := acc_hutang;
      IF v_debit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang (2101) tidak ditemukan.');
      END IF;
    END IF;

    -- BALANCE GUARD
    SELECT total_debit, total_credit
    INTO v_cash_total_debit, v_cash_total_credit
    FROM public.account_balances
    WHERE org_id = p_org_id
      AND account_id = p_account_id;

    v_cash_balance := COALESCE(v_cash_total_debit, 0) - COALESCE(v_cash_total_credit, 0);

    IF v_cash_balance < p_amount THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'DITOLAK: Saldo Kas Tidak Mencukupi! Saldo (' || v_cash_balance || ') lebih kecil dari tagihan (' || p_amount || ')');
    END IF;

    v_total_invoice := COALESCE(v_purchase.grand_total, 0);
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_returned FROM public.purchase_returns WHERE purchase_id = p_purchase_id;
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.purchase_payments WHERE purchase_id = p_purchase_id;

    v_remaining_ap := v_total_invoice - v_total_returned - v_total_paid;

    IF (p_amount + p_discount) > (v_remaining_ap + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar melebih sisa hutang: ' || v_remaining_ap);
    END IF;

    IF v_is_salam AND (p_amount + p_discount) < (v_remaining_ap - 0.01) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Akad SALAM pembelian wajib lunas di awal. Sisa kewajiban: ' || v_remaining_ap);
    END IF;

    SELECT COUNT(*) + 1
    INTO v_count
    FROM public.purchase_payments
    WHERE org_id = p_org_id
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    v_payment_number := 'PPAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    INSERT INTO public.purchase_payments (
      org_id, purchase_id, account_id, amount, discount_amount, payment_date, payment_number, notes, created_by
    )
    VALUES (
      p_org_id, p_purchase_id, p_account_id, p_amount, p_discount, p_payment_date, v_payment_number, p_notes, p_user_id
    )
    RETURNING id INTO v_payment_id;

    v_journal_desc := CASE 
      WHEN v_is_salam THEN 'Pembayaran SALAM Pembelian ' || v_payment_number 
      WHEN v_is_istishna THEN 'Pembayaran ISTISHNA Pembelian ' || v_payment_number 
      ELSE 'Pembayaran Pembelian ' || v_payment_number 
    END;

    IF p_notes IS NOT NULL AND BTRIM(p_notes) != '' THEN
        v_journal_desc := v_journal_desc || ' (' || p_notes || ')';
    END IF;

    INSERT INTO public.journal_entries (
      org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto
    )
    VALUES (
      p_org_id, v_purchase.branch_id, p_payment_date, v_journal_desc, 'PURCHASE_PAYMENT', v_payment_id, 'POSTED', TRUE
    )
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_debit_account_id, p_amount + p_discount, 0);

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, p_account_id, 0, p_amount);

    IF p_discount > 0 THEN
        IF acc_potongan IS NULL THEN
             RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Potongan (5004) tidak ditemukan.');
        END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, acc_potongan, 0, p_discount);
    END IF;

    IF (v_total_paid + p_amount + p_discount) >= (v_total_invoice - v_total_returned - 0.01) THEN
        UPDATE public.purchases SET payment_status = 'PAID' WHERE id = p_purchase_id;
    ELSE
        UPDATE public.purchases SET payment_status = 'PARTIAL' WHERE id = p_purchase_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."process_purchase_payment_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_purchase_return_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_return_number" "text", "p_return_date" timestamp with time zone, "p_notes" "text", "p_items" "jsonb", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_purchase RECORD;
  v_return_id UUID;
  v_item RECORD;
  v_total_net NUMERIC := 0;
  v_total_tax NUMERIC := 0;
  v_total_return NUMERIC := 0;
  v_je_id UUID;
  v_resolved_warehouse UUID;
  v_item_inventory_account UUID;
  v_inventory_credit_by_account JSONB := '{}'::JSONB;
  v_credit_line RECORD;
  v_inventory_line_amount NUMERIC;
  acc_hutang UUID;
  acc_ppn_masukan UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Authentication required.');
  END IF;

  IF NOT public.nizam_has_permission('purchasing:write', p_org_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Insufficient permission to create purchase return.');
  END IF;

  SELECT *
  INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id
    AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'PO tidak ditemukan.');
  END IF;

  IF v_purchase.branch_id IS NOT NULL
     AND NOT public.can_access_branch(p_org_id, v_purchase.branch_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Anda tidak memiliki akses unit untuk retur PO ini.');
  END IF;

  v_resolved_warehouse := COALESCE(
    v_purchase.warehouse_id,
    public.resolve_single_active_warehouse(p_org_id, v_purchase.branch_id)
  );

  IF v_resolved_warehouse IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Warehouse penerimaan tidak ditemukan sehingga retur tidak bisa sinkron ke stok fisik.'
    );
  END IF;

  SELECT id INTO acc_hutang FROM public.accounts WHERE code = '2101' AND org_id = p_org_id LIMIT 1;
  SELECT id INTO acc_ppn_masukan FROM public.accounts WHERE code = '1401' AND org_id = p_org_id LIMIT 1;

  IF acc_hutang IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Akun hutang (2101) belum lengkap untuk retur pembelian.');
  END IF;

  INSERT INTO public.purchase_returns (
    org_id,
    purchase_id,
    return_number,
    return_date,
    notes,
    created_by,
    branch_id
  )
  VALUES (
    p_org_id,
    p_purchase_id,
    p_return_number,
    p_return_date,
    p_notes,
    p_user_id,
    v_purchase.branch_id
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN
    SELECT *
    FROM jsonb_to_recordset(p_items) AS x(
      product_id UUID,
      quantity NUMERIC,
      unit_price NUMERIC,
      purchase_item_id UUID
    )
  LOOP
    IF COALESCE(v_item.quantity, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantity retur harus lebih besar dari nol.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.purchase_items pi
      WHERE pi.id = v_item.purchase_item_id
        AND pi.purchase_id = p_purchase_id
        AND pi.org_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Item retur tidak valid untuk purchase %', p_purchase_id;
    END IF;

    INSERT INTO public.purchase_return_items (
      return_id,
      purchase_item_id,
      product_id,
      quantity,
      unit_price,
      total_price
    )
    VALUES (
      v_return_id,
      v_item.purchase_item_id,
      v_item.product_id,
      v_item.quantity,
      v_item.unit_price,
      v_item.quantity * v_item.unit_price
    );

    INSERT INTO public.stock_movements (
      org_id,
      branch_id,
      product_id,
      quantity,
      unit_price,
      reference_type,
      reference_id,
      notes
    )
    VALUES (
      p_org_id,
      v_purchase.branch_id,
      v_item.product_id,
      -v_item.quantity,
      v_item.unit_price,
      'PURCHASE_RETURN',
      v_return_id,
      'Retur Pembelian ' || COALESCE(p_return_number, '')
    );

    PERFORM public.adjust_inventory_stock(
      p_org_id,
      v_item.product_id,
      v_resolved_warehouse,
      -v_item.quantity,
      NULL,
      NULL
    );

    v_item_inventory_account := public.resolve_inventory_asset_account(p_org_id, v_item.product_id, '1301');
    IF v_item_inventory_account IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Akun persediaan produk retur pembelian belum diatur.');
    END IF;

    v_inventory_line_amount := v_item.quantity * v_item.unit_price;

    v_inventory_credit_by_account := jsonb_set(
      v_inventory_credit_by_account,
      ARRAY[v_item_inventory_account::TEXT],
      to_jsonb(COALESCE((v_inventory_credit_by_account ->> v_item_inventory_account::TEXT)::NUMERIC, 0) + v_inventory_line_amount),
      TRUE
    );

    v_total_net := v_total_net + v_inventory_line_amount;
  END LOOP;

  v_total_tax := v_total_net * 0.11;
  v_total_return := v_total_net + v_total_tax;

  UPDATE public.purchase_returns
  SET total_amount = v_total_return,
      tax_amount = v_total_tax
  WHERE id = v_return_id;

  INSERT INTO public.journal_entries (
    org_id,
    branch_id,
    entry_date,
    description,
    reference_type,
    reference_id,
    status,
    is_auto
  )
  VALUES (
    p_org_id,
    v_purchase.branch_id,
    p_return_date,
    'Retur Pembelian ' || COALESCE(p_return_number, ''),
    'PURCHASE_RETURN',
    v_return_id,
    'POSTED',
    TRUE
  )
  RETURNING id INTO v_je_id;

  INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
  VALUES (v_je_id, acc_hutang, v_total_return, 0);

  FOR v_credit_line IN
    SELECT key, value
    FROM jsonb_each_text(v_inventory_credit_by_account)
  LOOP
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_credit_line.key::UUID, 0, v_credit_line.value::NUMERIC);
  END LOOP;

  IF v_total_tax > 0 AND acc_ppn_masukan IS NOT NULL THEN
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, acc_ppn_masukan, 0, v_total_tax);
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."process_purchase_return_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_return_number" "text", "p_return_date" timestamp with time zone, "p_notes" "text", "p_items" "jsonb", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.process_sales_delivery_atomic(p_org_id, p_sale_id, NULL);
END;
$$;


ALTER FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_warehouse_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_hpp NUMERIC;
    v_total_hpp NUMERIC := 0;
    v_entry_id UUID;
    v_revenue NUMERIC;
    v_acc_ar UUID;
    v_acc_hutang_salam UUID;
    v_acc_hutang_istishna UUID;
    v_acc_debit_target UUID;
    v_acc_revenue UUID;
    v_acc_tax UUID;
    v_acc_cogs UUID;
    v_requires_inventory_sync BOOLEAN;
    v_resolved_warehouse_id UUID;
    v_warehouse_branch_id UUID;
    v_warehouse_is_active BOOLEAN;
    v_item_inventory_account UUID;
    v_inventory_credit_by_account JSONB := '{}'::JSONB;
    v_credit_line RECORD;
    v_is_salam BOOLEAN := FALSE;
    v_is_istishna BOOLEAN := FALSE;
    v_total_paid_istishna NUMERIC := 0;
    v_istishna_debit NUMERIC := 0;
    v_ar_debit NUMERIC := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
          USING ERRCODE = '42501';
    END IF;

    IF NOT public.nizam_has_permission('sales:write', p_org_id) THEN
        RAISE EXCEPTION 'Insufficient permission to deliver sales for organization %', p_org_id
          USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale order not found';
    END IF;

    v_is_salam := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'SALAM';
    v_is_istishna := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'ISTISHNA';

    IF v_sale.branch_id IS NOT NULL
       AND NOT public.can_access_branch(p_org_id, v_sale.branch_id) THEN
        RAISE EXCEPTION 'Branch % is not accessible for current user', v_sale.branch_id
          USING ERRCODE = '42501';
    END IF;

    IF v_sale.status = 'FINISHED' THEN
        RETURN;
    END IF;

    IF v_sale.status = 'VOIDED' THEN
        RAISE EXCEPTION 'Sale order has been voided';
    END IF;

    IF v_is_salam AND COALESCE(v_sale.payment_status::TEXT, 'UNPAID') <> 'PAID' THEN
      RAISE EXCEPTION 'Akad SALAM wajib lunas terlebih dahulu sebelum pengiriman barang.';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.sales_items si
      JOIN public.products p ON p.id = si.product_id
      WHERE si.sale_id = p_sale_id
        AND COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
    )
    INTO v_requires_inventory_sync;

    IF v_requires_inventory_sync THEN
        v_resolved_warehouse_id := COALESCE(
          p_warehouse_id,
          v_sale.warehouse_id,
          public.resolve_single_active_warehouse(p_org_id, v_sale.branch_id)
        );

        IF v_resolved_warehouse_id IS NULL THEN
            RAISE EXCEPTION 'Pilih gudang pengiriman terlebih dahulu untuk mengurangi stok fisik.'
              USING ERRCODE = 'P0001';
        END IF;

        SELECT branch_id, is_active
        INTO v_warehouse_branch_id, v_warehouse_is_active
        FROM public.warehouses
        WHERE id = v_resolved_warehouse_id
          AND org_id = p_org_id;

        IF NOT FOUND OR v_warehouse_is_active IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION 'Gudang pengiriman tidak ditemukan atau tidak aktif.';
        END IF;

        IF v_sale.branch_id IS NOT NULL
           AND v_warehouse_branch_id IS DISTINCT FROM v_sale.branch_id THEN
            RAISE EXCEPTION 'Gudang pengiriman tidak berada pada unit yang sama dengan sales order.';
        END IF;
    END IF;

    SELECT id INTO v_acc_ar
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '1201'
    LIMIT 1;

    SELECT id INTO v_acc_revenue
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '4001'
    LIMIT 1;

    SELECT id INTO v_acc_tax
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '2201'
    LIMIT 1;

    SELECT id INTO v_acc_cogs
    FROM public.accounts
    WHERE org_id = p_org_id AND code = '5001'
    LIMIT 1;

    IF v_is_salam THEN
      v_acc_hutang_salam := public.ensure_salam_liability_account(p_org_id);
      v_acc_debit_target := v_acc_hutang_salam;
    ELSIF v_is_istishna THEN
      v_acc_hutang_istishna := public.ensure_istishna_liability_account(p_org_id);
      
      SELECT COALESCE(SUM(amount + discount_amount), 0) 
      INTO v_total_paid_istishna 
      FROM public.sales_payments 
      WHERE sale_id = p_sale_id;

      v_istishna_debit := LEAST(v_total_paid_istishna, v_sale.grand_total);
      v_ar_debit := GREATEST(v_sale.grand_total - v_istishna_debit, 0);
    ELSE
      v_acc_debit_target := v_acc_ar;
    END IF;

    IF v_is_salam AND v_acc_hutang_salam IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (Hutang Salam tidak ada).';
    END IF;
    IF v_is_istishna AND v_acc_hutang_istishna IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (Hutang Istishna tidak ada).';
    END IF;
    IF NOT v_is_salam AND NOT v_is_istishna AND v_acc_debit_target IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (Piutang 1201 tidak ada).';
    END IF;
    IF v_acc_revenue IS NULL OR v_acc_tax IS NULL OR v_acc_cogs IS NULL THEN
        RAISE EXCEPTION 'Akun pembukuan penjualan belum lengkap (4001, 2201, 5001).';
    END IF;

    FOR v_item IN
        SELECT
          si.*,
          p.type AS product_type,
          p.asset_account_id AS asset_account_id
        FROM public.sales_items si
        LEFT JOIN public.products p ON p.id = si.product_id
        WHERE si.sale_id = p_sale_id
    LOOP
        IF v_item.product_id IS NULL OR COALESCE(v_item.product_type, 'INVENTORY') <> 'INVENTORY' THEN
            CONTINUE;
        END IF;

        SELECT COALESCE(average_cost, 0)
        INTO v_hpp
        FROM public.products
        WHERE id = v_item.product_id;

        v_total_hpp := v_total_hpp + (v_hpp * v_item.quantity);

        v_item_inventory_account := COALESCE(
          v_item.asset_account_id,
          public.resolve_inventory_asset_account(p_org_id, v_item.product_id, '1301')
        );

        IF v_item_inventory_account IS NULL THEN
          RAISE EXCEPTION 'Akun persediaan produk % belum diatur.', v_item.product_id;
        END IF;

        v_inventory_credit_by_account := jsonb_set(
          v_inventory_credit_by_account,
          ARRAY[v_item_inventory_account::TEXT],
          to_jsonb(COALESCE((v_inventory_credit_by_account ->> v_item_inventory_account::TEXT)::NUMERIC, 0) + (v_hpp * v_item.quantity)),
          TRUE
        );

        INSERT INTO public.stock_movements (
          org_id,
          product_id,
          quantity,
          unit_price,
          reference_type,
          reference_id,
          notes,
          branch_id
        )
        VALUES (
          p_org_id,
          v_item.product_id,
          -(v_item.quantity),
          v_hpp,
          'SALE',
          p_sale_id,
          'Pengiriman SO ' || v_sale.sale_number,
          COALESCE(v_item.branch_id, v_sale.branch_id)
        );

        PERFORM public.adjust_inventory_stock(
          p_org_id,
          v_item.product_id,
          v_resolved_warehouse_id,
          -(v_item.quantity),
          NULL,
          NULL
        );
    END LOOP;

    UPDATE public.sales
    SET status = 'FINISHED',
        warehouse_id = COALESCE(v_resolved_warehouse_id, warehouse_id),
        updated_at = NOW()
    WHERE id = p_sale_id;

    INSERT INTO public.journal_entries (
      org_id,
      branch_id,
      entry_date,
      description,
      reference_id,
      reference_type,
      status,
      is_auto
    )
    VALUES (
      p_org_id,
      v_sale.branch_id,
      CURRENT_DATE,
      CASE 
        WHEN v_is_salam THEN 'Pengakuan Pendapatan & PPN atas Delivery SALAM SO ' || v_sale.sale_number
        WHEN v_is_istishna THEN 'Pengakuan Pendapatan & PPN atas Delivery ISTISHNA SO ' || v_sale.sale_number
        ELSE 'Pengakuan Laba, Piutang, & PPN atas Penjualan SO ' || v_sale.sale_number
      END,
      p_sale_id,
      'SALE',
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_entry_id;

    -- Debit line(s) for AR / Obligations
    IF v_is_istishna THEN
        IF v_istishna_debit > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
            VALUES (v_entry_id, v_acc_hutang_istishna, v_istishna_debit, 0);
        END IF;
        IF v_ar_debit > 0 THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
            VALUES (v_entry_id, v_acc_ar, v_ar_debit, 0);
        END IF;
    ELSE
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_debit_target, v_sale.grand_total, 0);
    END IF;

    IF v_sale.tax_amount > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_tax, 0, v_sale.tax_amount);
    END IF;

    v_revenue := v_sale.total_amount - v_sale.discount_amount;
    IF v_revenue > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_revenue, 0, v_revenue);
    END IF;

    IF v_total_hpp > 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_entry_id, v_acc_cogs, v_total_hpp, 0);

        FOR v_credit_line IN
          SELECT key, value
          FROM jsonb_each_text(v_inventory_credit_by_account)
        LOOP
          INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
          VALUES (v_entry_id, v_credit_line.key::UUID, 0, v_credit_line.value::NUMERIC);
        END LOOP;
    END IF;
END;
$$;


ALTER FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_warehouse_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_sales_payment_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_payment_id UUID;
    v_payment_number TEXT;
    v_je_id UUID;
    v_total_invoice DECIMAL;
    v_total_returned DECIMAL;
    v_total_paid DECIMAL;
    v_remaining_ar DECIMAL;
    v_count INT;
    v_sale RECORD;
    v_is_salam BOOLEAN := FALSE;
    v_is_istishna BOOLEAN := FALSE;
    v_credit_account_id UUID;
    acc_piutang UUID;
    acc_diskon UUID;
    v_journal_desc TEXT;
BEGIN
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_diskon FROM public.accounts WHERE code = '4002' AND org_id = p_org_id;

    SELECT id, branch_id, grand_total, shariah_mode, status
    INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invoice penjualan tidak ditemukan.');
    END IF;

    v_is_salam := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'SALAM';
    v_is_istishna := UPPER(COALESCE(v_sale.shariah_mode::TEXT, 'CASH')) = 'ISTISHNA';

    IF v_is_salam THEN
      v_credit_account_id := public.ensure_salam_liability_account(p_org_id);
      IF v_credit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang Salam (2602) belum tersedia di CoA.');
      END IF;
    ELSIF v_is_istishna THEN
      IF COALESCE(v_sale.status::TEXT, '') = 'FINISHED' THEN
        v_credit_account_id := acc_piutang;
        IF v_credit_account_id IS NULL THEN
          RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang (1201) tidak ditemukan.');
        END IF;
      ELSE
        v_credit_account_id := public.ensure_istishna_liability_account(p_org_id);
        IF v_credit_account_id IS NULL THEN
          RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Hutang Istishna (2603) belum tersedia di CoA.');
        END IF;
      END IF;
    ELSE
      v_credit_account_id := acc_piutang;
      IF v_credit_account_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Piutang (1201) tidak ditemukan.');
      END IF;
    END IF;

    v_total_invoice := COALESCE(v_sale.grand_total, 0);
    SELECT COALESCE(SUM(grand_total), 0) INTO v_total_returned FROM public.sales_returns WHERE sale_id = p_sale_id;
    SELECT COALESCE(SUM(amount + discount_amount), 0) INTO v_total_paid FROM public.sales_payments WHERE sale_id = p_sale_id;

    v_remaining_ar := v_total_invoice - v_total_returned - v_total_paid;

    IF (p_amount + p_discount) > (v_remaining_ar + 0.01) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah bayar + diskon melebih sisa tagihan: ' || v_remaining_ar);
    END IF;

    IF v_is_salam AND (p_amount + p_discount) < (v_remaining_ar - 0.01) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Akad SALAM wajib lunas di awal. Sisa tagihan: ' || v_remaining_ar);
    END IF;

    SELECT COUNT(*) + 1 INTO v_count FROM public.sales_payments WHERE org_id = p_org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    v_payment_number := 'PAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');

    INSERT INTO public.sales_payments (
      org_id, branch_id, sale_id, account_id, amount, discount_amount, payment_date, payment_number, notes, created_by
    )
    VALUES (
      p_org_id, v_sale.branch_id, p_sale_id, p_account_id, p_amount, p_discount, p_payment_date, v_payment_number, p_notes, p_user_id
    )
    RETURNING id INTO v_payment_id;

    -- Generate Journal Description combining Payment Type + Number + Notes (DP explicit)
    v_journal_desc := CASE 
        WHEN v_is_salam THEN 'Pembayaran SALAM ' || v_payment_number 
        WHEN v_is_istishna THEN 'Pembayaran ISTISHNA ' || v_payment_number 
        ELSE 'Pembayaran Invoice ' || v_payment_number 
    END;

    IF p_notes IS NOT NULL AND BTRIM(p_notes) != '' THEN
        v_journal_desc := v_journal_desc || ' (' || p_notes || ')';
    END IF;

    INSERT INTO public.journal_entries (
      org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto
    )
    VALUES (
      p_org_id,
      v_sale.branch_id,
      p_payment_date,
      v_journal_desc,
      'PAYMENT_IN',
      v_payment_id,
      'POSTED',
      TRUE
    )
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, p_account_id, p_amount, 0);

    IF p_discount > 0 THEN
        IF acc_diskon IS NULL THEN
             RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Diskon Penjualan (4002) tidak ditemukan.');
        END IF;
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_diskon, p_discount, 0);
    END IF;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
    VALUES (v_je_id, v_credit_account_id, 0, p_amount + p_discount);

    IF (v_total_paid + p_amount + p_discount) >= (v_total_invoice - v_total_returned - 0.01) THEN
        UPDATE public.sales SET payment_status = 'PAID' WHERE id = p_sale_id;
    ELSE
        UPDATE public.sales SET payment_status = 'PARTIAL' WHERE id = p_sale_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."process_sales_payment_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_sales_return_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_return_number" "text", "p_nota_retur" "text", "p_items" "jsonb", "p_user_id" "uuid", "p_refund_account_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_return_id UUID;
    v_item RECORD;
    v_total_net DECIMAL(15,2) := 0;
    v_total_tax DECIMAL(15,2) := 0;
    v_total_return DECIMAL(15,2) := 0;
    v_hpp_total DECIMAL(15,2) := 0;
    v_avg_cost DECIMAL(15,2);
    v_je_id UUID;
    v_sale_branch_id UUID;
    v_sale_warehouse_id UUID;
    v_requires_inventory_sync BOOLEAN;
    v_item_inventory_account UUID;
    v_inventory_debit_by_account JSONB := '{}'::JSONB;
    v_inventory_line RECORD;
    v_inventory_amount NUMERIC;
    acc_piutang UUID;
    acc_retur_penjualan UUID;
    acc_ppn_keluaran UUID;
    acc_hpp UUID;
    v_target_credit_account UUID;
    v_product_type TEXT;
BEGIN
    SELECT id INTO acc_piutang FROM public.accounts WHERE code = '1201' AND org_id = p_org_id;
    SELECT id INTO acc_retur_penjualan FROM public.accounts WHERE code = '4003' AND org_id = p_org_id;
    SELECT id INTO acc_ppn_keluaran FROM public.accounts WHERE code = '2201' AND org_id = p_org_id;
    SELECT id INTO acc_hpp FROM public.accounts WHERE code = '5001' AND org_id = p_org_id;

    SELECT branch_id, warehouse_id
    INTO v_sale_branch_id, v_sale_warehouse_id
    FROM public.sales
    WHERE id = p_sale_id
      AND org_id = p_org_id;

    v_sale_warehouse_id := COALESCE(
      v_sale_warehouse_id,
      public.resolve_single_active_warehouse(p_org_id, v_sale_branch_id)
    );

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
      JOIN public.products p ON p.id = x.product_id
      WHERE COALESCE(p.type, 'INVENTORY') = 'INVENTORY'
    )
    INTO v_requires_inventory_sync;

    IF v_requires_inventory_sync AND v_sale_warehouse_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang asal penjualan tidak ditemukan. Tidak bisa mengembalikan stok fisik.');
    END IF;

    IF acc_piutang IS NULL OR acc_retur_penjualan IS NULL OR acc_ppn_keluaran IS NULL OR acc_hpp IS NULL THEN
         RETURN jsonb_build_object('success', FALSE, 'error', 'Akun Pembukuan (1201, 4003, 2201, 5001) belum lengkap di COA.');
    END IF;

    v_target_credit_account := COALESCE(p_refund_account_id, acc_piutang);

    INSERT INTO public.sales_returns (org_id, branch_id, sale_id, return_number, nota_retur_number, created_by, status)
    VALUES (p_org_id, v_sale_branch_id, p_sale_id, p_return_number, p_nota_retur, p_user_id, 'COMPLETED')
    RETURNING id INTO v_return_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity DECIMAL, unit_price DECIMAL, sale_item_id UUID)
    LOOP
        INSERT INTO public.sales_return_items (return_id, sale_item_id, product_id, quantity, unit_price, total_price)
        VALUES (v_return_id, v_item.sale_item_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.quantity * v_item.unit_price);

        SELECT COALESCE(average_cost, 0), type, asset_account_id
        INTO v_avg_cost, v_product_type, v_item_inventory_account
        FROM public.products
        WHERE id = v_item.product_id;

        IF COALESCE(v_product_type, 'INVENTORY') = 'INVENTORY' THEN
            v_item_inventory_account := COALESCE(
              v_item_inventory_account,
              public.resolve_inventory_asset_account(p_org_id, v_item.product_id, '1301')
            );

            IF v_item_inventory_account IS NULL THEN
              RETURN jsonb_build_object('success', FALSE, 'error', 'Akun persediaan produk retur belum diatur.');
            END IF;

            v_inventory_amount := v_avg_cost * v_item.quantity;
            v_hpp_total := v_hpp_total + v_inventory_amount;

            v_inventory_debit_by_account := jsonb_set(
              v_inventory_debit_by_account,
              ARRAY[v_item_inventory_account::TEXT],
              to_jsonb(COALESCE((v_inventory_debit_by_account ->> v_item_inventory_account::TEXT)::NUMERIC, 0) + v_inventory_amount),
              TRUE
            );

            INSERT INTO public.stock_movements (
              org_id, product_id, quantity, unit_price, reference_type, reference_id, notes, branch_id
            )
            VALUES (
              p_org_id, v_item.product_id, v_item.quantity, v_avg_cost, 'SALES_RETURN', v_return_id,
              'Retur dr ' || p_return_number, v_sale_branch_id
            );

            PERFORM public.adjust_inventory_stock(
              p_org_id,
              v_item.product_id,
              v_sale_warehouse_id,
              v_item.quantity,
              NULL,
              NULL
            );
        END IF;

        v_total_net := v_total_net + (v_item.quantity * v_item.unit_price);
    END LOOP;

    v_total_tax := v_total_net * 0.11;
    v_total_return := v_total_net + v_total_tax;

    UPDATE public.sales_returns SET grand_total = v_total_return, tax_amount = v_total_tax, total_amount = v_total_net WHERE id = v_return_id;

    INSERT INTO public.journal_entries (org_id, branch_id, entry_date, description, reference_type, reference_id, status)
    VALUES (p_org_id, v_sale_branch_id, NOW(), 'Retur Penjualan ' || p_return_number, 'SALES_RETURN', v_return_id, 'POSTED')
    RETURNING id INTO v_je_id;

    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_retur_penjualan, v_total_net, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, acc_ppn_keluaran, v_total_tax, 0);
    INSERT INTO public.journal_lines (entry_id, account_id, debit, credit) VALUES (v_je_id, v_target_credit_account, 0, v_total_return);

    IF v_hpp_total > 0 THEN
      FOR v_inventory_line IN
        SELECT key, value
        FROM jsonb_each_text(v_inventory_debit_by_account)
      LOOP
        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
        VALUES (v_je_id, v_inventory_line.key::UUID, v_inventory_line.value::NUMERIC, 0);
      END LOOP;

      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit)
      VALUES (v_je_id, acc_hpp, 0, v_hpp_total);
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'return_id', v_return_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."process_sales_return_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_return_number" "text", "p_nota_retur" "text", "p_items" "jsonb", "p_user_id" "uuid", "p_refund_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_work_order_completion"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_wo RECORD;
    v_bom RECORD;
    v_item RECORD;
    v_je_id UUID;
    v_total_rm_cost NUMERIC(20, 2) := 0;
    v_fg_asset_account_id UUID;
    v_org_id UUID;
    v_branch_id UUID;
    v_warehouse_branch_id UUID;
    v_warehouse_is_active BOOLEAN;
BEGIN
    SELECT * INTO v_wo
    FROM public.production_work_orders
    WHERE id = p_wo_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SPK tidak ditemukan.');
    END IF;

    IF v_wo.status != 'RELEASED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Hanya SPK berstatus RELEASED yang bisa diselesaikan.');
    END IF;

    IF p_warehouse_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi wajib dipilih.');
    END IF;

    IF COALESCE(v_wo.quantity_planned, 0) <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah target produksi tidak valid.');
    END IF;

    v_org_id := v_wo.org_id;
    v_branch_id := COALESCE(v_wo.branch_id, public.resolve_single_active_branch(v_wo.org_id));

    SELECT branch_id, is_active
    INTO v_warehouse_branch_id, v_warehouse_is_active
    FROM public.warehouses
    WHERE id = p_warehouse_id
      AND org_id = v_org_id;

    IF v_warehouse_branch_id IS NULL OR v_warehouse_is_active IS DISTINCT FROM TRUE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi tidak valid.');
    END IF;

    IF v_branch_id IS NOT NULL AND v_warehouse_branch_id IS DISTINCT FROM v_branch_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi tidak berada pada unit SPK.');
    END IF;

    SELECT b.*, p.asset_account_id as fg_account
    INTO v_bom
    FROM public.production_boms b
    JOIN public.products p ON p.id = b.product_id
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := v_bom.fg_account;

    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM public.accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
    END IF;
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM public.accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
    END IF;

    INSERT INTO public.journal_entries (
        org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, v_branch_id, NOW(),
        'Produksi Selesai: ' || v_wo.wo_number || ' (' || v_bom.code || ')',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    FOR v_item IN (
      SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name, p.unit as product_unit
      FROM public.production_bom_items bi
      JOIN public.products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_formula NUMERIC(20, 6) := COALESCE(v_item.quantity, 0) * COALESCE(v_wo.quantity_planned, 0);
            v_qty_to_consume NUMERIC(20, 6);
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
            v_rm_warehouse_id UUID;
        BEGIN
            v_qty_to_consume := public.convert_measurement_quantity(
              v_qty_formula,
              v_item.unit,
              v_item.product_unit
            );

            IF COALESCE(v_qty_to_consume, 0) <= 0 THEN
              CONTINUE;
            END IF;

            SELECT COALESCE(average_cost, purchase_price, 0) INTO v_unit_cost
            FROM public.products
            WHERE id = v_item.product_id;

            v_total_rm_cost := v_total_rm_cost + (v_qty_to_consume * v_unit_cost);

            INSERT INTO public.stock_movements (
                org_id, branch_id, product_id, movement_date, quantity, unit_price,
                reference_type, reference_id, notes
            ) VALUES (
                v_org_id, v_branch_id, v_item.product_id, NOW(), -v_qty_to_consume, v_unit_cost,
                'PRODUCTION_CONSUMPTION', v_wo.id, 'Consumed for ' || v_wo.wo_number
            );

            SELECT s.warehouse_id
            INTO v_rm_warehouse_id
            FROM public.inventory_stocks s
            JOIN public.warehouses w ON w.id = s.warehouse_id
            WHERE s.org_id = v_org_id
              AND s.product_id = v_item.product_id
              AND s.quantity > 0
              AND w.org_id = v_org_id
              AND w.is_active = TRUE
              AND (v_branch_id IS NULL OR w.branch_id = v_branch_id)
            ORDER BY s.quantity DESC, s.updated_at DESC NULLS LAST
            LIMIT 1;

            IF v_rm_warehouse_id IS NULL THEN
              v_rm_warehouse_id := p_warehouse_id;
            END IF;

            PERFORM public.adjust_inventory_stock(
              v_org_id,
              v_item.product_id,
              v_rm_warehouse_id,
              -v_qty_to_consume,
              NULL,
              NULL
            );

            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM public.accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
            END IF;
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM public.accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
            END IF;

            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    DECLARE
        v_fg_unit_cost NUMERIC(20, 2) := v_total_rm_cost / v_wo.quantity_planned;
    BEGIN
        INSERT INTO public.stock_movements (
            org_id, branch_id, product_id, movement_date, quantity, unit_price,
            reference_type, reference_id, notes
        ) VALUES (
            v_org_id, v_branch_id, v_bom.product_id, NOW(), v_wo.quantity_planned, v_fg_unit_cost,
            'PRODUCTION_OUTPUT', v_wo.id, 'Produced via ' || v_wo.wo_number
        );

        INSERT INTO public.inventory_stocks (org_id, product_id, warehouse_id, quantity)
        VALUES (v_org_id, v_bom.product_id, p_warehouse_id, v_wo.quantity_planned)
        ON CONFLICT (product_id, warehouse_id, COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'), COALESCE(batch_number, '')) DO UPDATE
        SET quantity = public.inventory_stocks.quantity + EXCLUDED.quantity;

        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_total_rm_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);

        UPDATE public.products SET
            average_cost = v_fg_unit_cost,
            purchase_price = v_fg_unit_cost,
            selling_price = CASE
                WHEN COALESCE(selling_price, 0) = 0 THEN ROUND(v_fg_unit_cost / 0.7 / 100) * 100
                ELSE selling_price
            END,
            updated_at = NOW()
        WHERE id = v_bom.product_id;
    END;

    UPDATE public.production_work_orders SET
        status = 'COMPLETED',
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object('success', TRUE, 'total_cost', v_total_rm_cost);
END;
$$;


ALTER FUNCTION "public"."process_work_order_completion"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_work_order_completion_v2"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid", "p_bin_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_wo RECORD;
    v_bom RECORD;
    v_item RECORD;
    v_je_id UUID;
    v_total_rm_cost NUMERIC(20, 2) := 0;
    v_total_overhead_cost NUMERIC(20, 2) := 0;
    v_grand_total_cost NUMERIC(20, 2) := 0;
    v_fg_asset_account_id UUID;
    v_org_id UUID;
    v_overhead_account_id UUID;
    v_branch_id UUID;
    v_warehouse_branch_id UUID;
    v_warehouse_is_active BOOLEAN;
BEGIN
    SELECT * INTO v_wo
    FROM public.production_work_orders
    WHERE id = p_wo_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'SPK tidak ditemukan.');
    END IF;

    IF v_wo.status != 'RELEASED' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Hanya SPK berstatus RELEASED yang bisa diselesaikan.');
    END IF;

    IF p_warehouse_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi wajib dipilih.');
    END IF;

    IF COALESCE(v_wo.quantity_planned, 0) <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Jumlah target produksi tidak valid.');
    END IF;

    v_org_id := v_wo.org_id;
    v_branch_id := COALESCE(v_wo.branch_id, public.resolve_single_active_branch(v_wo.org_id));

    SELECT branch_id, is_active
    INTO v_warehouse_branch_id, v_warehouse_is_active
    FROM public.warehouses
    WHERE id = p_warehouse_id
      AND org_id = v_org_id;

    IF v_warehouse_branch_id IS NULL OR v_warehouse_is_active IS DISTINCT FROM TRUE THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi tidak valid.');
    END IF;

    IF v_branch_id IS NOT NULL AND v_warehouse_branch_id IS DISTINCT FROM v_branch_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gudang hasil produksi tidak berada pada unit SPK.');
    END IF;

    IF p_bin_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.warehouse_bins
        WHERE id = p_bin_id
          AND warehouse_id = p_warehouse_id
          AND org_id = v_org_id
          AND is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Rak hasil produksi tidak valid untuk gudang terpilih.');
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_overhead_cost
    FROM public.production_wo_costs
    WHERE wo_id = p_wo_id;

    SELECT b.*, p.asset_account_id as fg_account
    INTO v_bom
    FROM public.production_boms b
    JOIN public.products p ON p.id = b.product_id
    WHERE b.id = v_wo.bom_id;

    v_fg_asset_account_id := v_bom.fg_account;

    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM public.accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
    END IF;
    IF v_fg_asset_account_id IS NULL THEN
        SELECT id INTO v_fg_asset_account_id FROM public.accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
    END IF;

    INSERT INTO public.journal_entries (
        org_id, branch_id, entry_date, description, reference_type, reference_id, status, is_auto, created_by
    ) VALUES (
        v_org_id, v_branch_id, NOW(),
        'Produksi Selesai: ' || v_wo.wo_number || ' (Inc. Overhead)',
        'PRODUCTION', v_wo.id, 'POSTED', TRUE, p_user_id
    ) RETURNING id INTO v_je_id;

    FOR v_item IN (
      SELECT bi.*, p.asset_account_id as rm_account, p.name as product_name, p.unit as product_unit
      FROM public.production_bom_items bi
      JOIN public.products p ON p.id = bi.product_id
      WHERE bi.bom_id = v_wo.bom_id
    ) LOOP
        DECLARE
            v_qty_formula NUMERIC(20, 6) := COALESCE(v_item.quantity, 0) * COALESCE(v_wo.quantity_planned, 0);
            v_qty_to_consume NUMERIC(20, 6);
            v_unit_cost NUMERIC(20, 2);
            v_rm_account UUID := v_item.rm_account;
            v_rm_warehouse_id UUID;
        BEGIN
            v_qty_to_consume := public.convert_measurement_quantity(
              v_qty_formula,
              v_item.unit,
              v_item.product_unit
            );

            IF COALESCE(v_qty_to_consume, 0) <= 0 THEN
              CONTINUE;
            END IF;

            SELECT COALESCE(average_cost, purchase_price, 0) INTO v_unit_cost
            FROM public.products
            WHERE id = v_item.product_id;

            v_total_rm_cost := v_total_rm_cost + (v_qty_to_consume * v_unit_cost);

            INSERT INTO public.stock_movements (
                org_id, branch_id, product_id, movement_date, quantity, unit_price,
                reference_type, reference_id, notes
            ) VALUES (
                v_org_id, v_branch_id, v_item.product_id, NOW(), -v_qty_to_consume, v_unit_cost,
                'PRODUCTION_CONSUMPTION', v_wo.id, 'Consumed for ' || v_wo.wo_number
            );

            SELECT s.warehouse_id
            INTO v_rm_warehouse_id
            FROM public.inventory_stocks s
            JOIN public.warehouses w ON w.id = s.warehouse_id
            WHERE s.org_id = v_org_id
              AND s.product_id = v_item.product_id
              AND s.quantity > 0
              AND w.org_id = v_org_id
              AND w.is_active = TRUE
              AND (v_branch_id IS NULL OR w.branch_id = v_branch_id)
            ORDER BY s.quantity DESC, s.updated_at DESC NULLS LAST
            LIMIT 1;

            IF v_rm_warehouse_id IS NULL THEN
              v_rm_warehouse_id := p_warehouse_id;
            END IF;

            PERFORM public.adjust_inventory_stock(
              v_org_id,
              v_item.product_id,
              v_rm_warehouse_id,
              -v_qty_to_consume,
              NULL,
              NULL
            );

            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM public.accounts WHERE org_id = v_org_id AND code = '1301' LIMIT 1;
            END IF;
            IF v_rm_account IS NULL THEN
                SELECT id INTO v_rm_account FROM public.accounts WHERE org_id = v_org_id AND type = 'ASSET' ORDER BY code LIMIT 1;
            END IF;

            INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
            VALUES (v_je_id, v_rm_account, 0, v_qty_to_consume * v_unit_cost, 'Bahan Baku: ' || v_item.product_name);
        END;
    END LOOP;

    IF v_total_overhead_cost > 0 THEN
        SELECT id INTO v_overhead_account_id FROM public.accounts WHERE org_id = v_org_id AND code = '6100' LIMIT 1;

        IF v_overhead_account_id IS NULL THEN
            SELECT id INTO v_overhead_account_id FROM public.accounts WHERE org_id = v_org_id AND code = '6001' LIMIT 1;
        END IF;
        IF v_overhead_account_id IS NULL THEN
            SELECT id INTO v_overhead_account_id FROM public.accounts WHERE org_id = v_org_id AND type = 'EXPENSE' ORDER BY code LIMIT 1;
        END IF;

        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_overhead_account_id, 0, v_total_overhead_cost, 'Biaya Overhead/Tenaga Kerja Produksi');
    END IF;

    v_grand_total_cost := v_total_rm_cost + v_total_overhead_cost;

    DECLARE
        v_fg_unit_cost NUMERIC(20, 2) := v_grand_total_cost / v_wo.quantity_planned;
    BEGIN
        INSERT INTO public.stock_movements (
            org_id, branch_id, product_id, movement_date, quantity, unit_price,
            reference_type, reference_id, notes
        ) VALUES (
            v_org_id, v_branch_id, v_bom.product_id, NOW(), v_wo.quantity_planned, v_fg_unit_cost,
            'PRODUCTION_OUTPUT', v_wo.id, 'Produced via ' || v_wo.wo_number
        );

        INSERT INTO public.inventory_stocks (org_id, product_id, warehouse_id, bin_id, quantity)
        VALUES (v_org_id, v_bom.product_id, p_warehouse_id, p_bin_id, v_wo.quantity_planned)
        ON CONFLICT (product_id, warehouse_id, COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'), COALESCE(batch_number, '')) DO UPDATE
        SET quantity = public.inventory_stocks.quantity + EXCLUDED.quantity;

        INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
        VALUES (v_je_id, v_fg_asset_account_id, v_grand_total_cost, 0, 'Produk Jadi: ' || v_wo.wo_number);

        UPDATE public.products SET
            average_cost = v_fg_unit_cost,
            purchase_price = v_fg_unit_cost,
            selling_price = CASE
                WHEN COALESCE(selling_price, 0) = 0 THEN ROUND(v_fg_unit_cost / 0.7 / 100) * 100
                ELSE selling_price
            END,
            updated_at = NOW()
        WHERE id = v_bom.product_id;
    END;

    UPDATE public.production_work_orders SET
        status = 'COMPLETED',
        completed_at = NOW(),
        quantity_actual = quantity_planned
    WHERE id = p_wo_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'rm_cost', v_total_rm_cost,
        'overhead_cost', v_total_overhead_cost,
        'total_cost', v_grand_total_cost,
        'fg_unit_cost', v_grand_total_cost / v_wo.quantity_planned
    );
END;
$$;


ALTER FUNCTION "public"."process_work_order_completion_v2"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid", "p_bin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_average_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_qty NUMERIC;
    v_total_value NUMERIC;
BEGIN
    SELECT SUM(quantity), SUM(quantity * unit_price)
    INTO v_total_qty, v_total_value
    FROM public.stock_movements WHERE product_id = NEW.product_id;

    IF v_total_qty > 0 THEN
        UPDATE public.products SET average_cost = (v_total_value / v_total_qty) WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END; $$;


ALTER FUNCTION "public"."recalculate_average_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_coa_request"("p_request_id" "uuid", "p_review_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_req public.coa_account_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  SELECT * INTO v_req
  FROM public.coa_account_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request CoA tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya request berstatus pending yang dapat ditolak. Status saat ini: %', v_req.status;
  END IF;

  IF NOT public.can_manage_finance_master(v_req.org_id) THEN
    RAISE EXCEPTION 'Hanya Organisasi Utama (Parent) yang dapat menolak request CoA.';
  END IF;

  IF p_review_notes IS NULL OR trim(p_review_notes) = '' THEN
    RAISE EXCEPTION 'Catatan alasan penolakan wajib diisi.';
  END IF;

  UPDATE public.coa_account_requests
  SET
    status       = 'rejected',
    reviewed_by  = auth.uid(),
    reviewed_at  = now(),
    review_notes = p_review_notes
  WHERE id = p_request_id;
END;
$$;


ALTER FUNCTION "public"."reject_coa_request"("p_request_id" "uuid", "p_review_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."repair_bank_transaction_report_sync"("p_org_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tx RECORD;
  v_je_id UUID;
  v_bank_gl_account_id UUID;
  v_bank_branch_id UUID;
  v_branch_id UUID;
  v_ref_type journal_reference_type;
  v_fixed_bank_tx_branch_count INTEGER := 0;
  v_fixed_journal_branch_count INTEGER := 0;
  v_linked_existing_journal_count INTEGER := 0;
  v_created_journal_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_noop_posting_count INTEGER := 0;
  v_retyped_interorg_source_count INTEGER := 0;
  v_retyped_interorg_journal_count INTEGER := 0;
BEGIN
  -- 1) Legacy-safe: normalisasi branch_id bank_transactions jika masih NULL
  WITH fixed_tx AS (
    UPDATE public.bank_transactions bt
    SET branch_id = COALESCE(
      ba.branch_id,
      public.get_default_branch_id(bt.org_id)
    )
    FROM public.bank_accounts ba
    WHERE bt.branch_id IS NULL
      AND ba.id = bt.bank_account_id
      AND ba.org_id = bt.org_id
      AND (p_org_id IS NULL OR bt.org_id = p_org_id)
    RETURNING bt.id
  )
  SELECT COUNT(*) INTO v_fixed_bank_tx_branch_count FROM fixed_tx;

  -- 2) Pastikan journal_entries bank tx punya branch_id agar terbaca laporan per unit
  WITH fixed_je AS (
    UPDATE public.journal_entries je
    SET branch_id = COALESCE(
      bt.branch_id,
      ba.branch_id,
      public.get_default_branch_id(bt.org_id)
    )
    FROM public.bank_transactions bt
    LEFT JOIN public.bank_accounts ba
      ON ba.id = bt.bank_account_id
     AND ba.org_id = bt.org_id
    WHERE je.reference_id = bt.id
      AND je.reference_type IN ('CASH_IN', 'CASH_OUT', 'TRANSFER', 'BANK_TRANSFER')
      AND je.branch_id IS NULL
      AND (p_org_id IS NULL OR je.org_id = p_org_id)
    RETURNING je.id
  )
  SELECT COUNT(*) INTO v_fixed_journal_branch_count FROM fixed_je;

  -- 3) Link ulang bila jurnal sebenarnya sudah ada tetapi pointer tx kosong
  WITH linked_existing AS (
    UPDATE public.bank_transactions bt
    SET journal_entry_id = je.id,
        updated_at = NOW()
    FROM public.journal_entries je
    WHERE bt.status = 'POSTED'
      AND bt.journal_entry_id IS NULL
      AND je.org_id = bt.org_id
      AND je.reference_id = bt.id
      AND je.reference_type IN ('CASH_IN', 'CASH_OUT', 'TRANSFER', 'BANK_TRANSFER')
      AND (p_org_id IS NULL OR bt.org_id = p_org_id)
    RETURNING bt.id
  )
  SELECT COUNT(*) INTO v_linked_existing_journal_count FROM linked_existing;

  -- 4) Buat jurnal untuk tx POSTED yang belum punya jurnal sama sekali
  FOR v_tx IN
    SELECT
      bt.id,
      bt.org_id,
      bt.branch_id,
      bt.bank_account_id,
      bt.transaction_date,
      bt.description,
      bt.amount,
      bt.type,
      bt.category_id,
      bt.created_by
    FROM public.bank_transactions bt
    LEFT JOIN public.journal_entries je
      ON je.id = bt.journal_entry_id
    WHERE bt.status = 'POSTED'
      AND (p_org_id IS NULL OR bt.org_id = p_org_id)
      AND (bt.journal_entry_id IS NULL OR je.id IS NULL)
    ORDER BY bt.transaction_date ASC, bt.created_at ASC, bt.id ASC
  LOOP
    -- Coba cari lagi by reference_id untuk jaga-jaga race/duplikasi
    SELECT je.id
      INTO v_je_id
    FROM public.journal_entries je
    WHERE je.org_id = v_tx.org_id
      AND je.reference_id = v_tx.id
      AND je.reference_type IN ('CASH_IN', 'CASH_OUT', 'TRANSFER', 'BANK_TRANSFER')
    ORDER BY je.created_at DESC
    LIMIT 1;

    IF v_je_id IS NOT NULL THEN
      UPDATE public.bank_transactions
      SET journal_entry_id = v_je_id,
          updated_at = NOW()
      WHERE id = v_tx.id;
      v_linked_existing_journal_count := v_linked_existing_journal_count + 1;
      CONTINUE;
    END IF;

    -- Wajib punya akun lawan untuk membuat jurnal
    IF v_tx.category_id IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    SELECT ba.account_id, ba.branch_id
      INTO v_bank_gl_account_id, v_bank_branch_id
    FROM public.bank_accounts ba
    WHERE ba.id = v_tx.bank_account_id
      AND ba.org_id = v_tx.org_id
    LIMIT 1;

    IF v_bank_gl_account_id IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = v_tx.category_id
        AND a.org_id = v_tx.org_id
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    v_branch_id := COALESCE(
      v_tx.branch_id,
      v_bank_branch_id,
      public.get_default_branch_id(v_tx.org_id)
    );

    IF v_branch_id IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    IF v_tx.type::TEXT = 'IN' THEN
      v_ref_type := 'CASH_IN';
    ELSIF v_tx.type::TEXT = 'TRANSFER' THEN
      v_ref_type := 'BANK_TRANSFER';
    ELSE
      v_ref_type := 'CASH_OUT';
    END IF;

    INSERT INTO public.journal_entries (
      org_id,
      branch_id,
      entry_date,
      description,
      reference_type,
      reference_id,
      status,
      is_auto,
      created_by
    ) VALUES (
      v_tx.org_id,
      v_branch_id,
      v_tx.transaction_date,
      COALESCE(v_tx.description, 'Auto Repair: Bank Transaction'),
      v_ref_type,
      v_tx.id,
      'POSTED',
      TRUE,
      v_tx.created_by
    )
    RETURNING id INTO v_je_id;

    IF v_tx.type::TEXT = 'IN' THEN
      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (v_je_id, v_bank_gl_account_id, v_tx.amount, 0, COALESCE(v_tx.description, 'Auto Repair'));

      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (v_je_id, v_tx.category_id, 0, v_tx.amount, COALESCE(v_tx.description, 'Auto Repair'));
    ELSE
      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (v_je_id, v_tx.category_id, v_tx.amount, 0, COALESCE(v_tx.description, 'Auto Repair'));

      INSERT INTO public.journal_lines (entry_id, account_id, debit, credit, memo)
      VALUES (v_je_id, v_bank_gl_account_id, 0, v_tx.amount, COALESCE(v_tx.description, 'Auto Repair'));
    END IF;

    UPDATE public.bank_transactions
    SET journal_entry_id = v_je_id,
        updated_at = NOW()
    WHERE id = v_tx.id;

    v_created_journal_count := v_created_journal_count + 1;
  END LOOP;

  -- 5) Audit no-op posting (akun lawan = akun bank) agar user tahu
  SELECT COUNT(*)
    INTO v_noop_posting_count
  FROM public.bank_transactions bt
  JOIN public.bank_accounts ba
    ON ba.id = bt.bank_account_id
   AND ba.org_id = bt.org_id
  WHERE bt.status = 'POSTED'
    AND bt.category_id = ba.account_id
    AND (p_org_id IS NULL OR bt.org_id = p_org_id);

  -- 6) Backfill label source transfer antar entitas:
  --    OUT/CASH_OUT -> TRANSFER/BANK_TRANSFER
  WITH interorg_source AS (
    SELECT DISTINCT src.id AS source_tx_id
    FROM public.bank_transactions src
    JOIN public.bank_transactions tgt
      ON tgt.status = 'POSTED'
     AND tgt.type = 'IN'
     AND tgt.org_id <> src.org_id
     AND tgt.amount = src.amount
     AND tgt.transaction_date = src.transaction_date
     AND COALESCE(tgt.reference_number, '') = COALESCE(src.reference_number, '')
     AND tgt.created_by IS NOT DISTINCT FROM src.created_by
    WHERE src.status = 'POSTED'
      AND src.type = 'OUT'
      AND public.is_org_in_consolidation_tree(tgt.org_id, src.org_id)
      AND (p_org_id IS NULL OR src.org_id = p_org_id OR tgt.org_id = p_org_id)
  ),
  updated_source AS (
    UPDATE public.bank_transactions bt
    SET type = 'TRANSFER',
        updated_at = NOW()
    FROM interorg_source src
    WHERE bt.id = src.source_tx_id
    RETURNING bt.id
  )
  SELECT COUNT(*) INTO v_retyped_interorg_source_count FROM updated_source;

  WITH interorg_source AS (
    SELECT DISTINCT src.id AS source_tx_id
    FROM public.bank_transactions src
    JOIN public.bank_transactions tgt
      ON tgt.status = 'POSTED'
     AND tgt.type = 'IN'
     AND tgt.org_id <> src.org_id
     AND tgt.amount = src.amount
     AND tgt.transaction_date = src.transaction_date
     AND COALESCE(tgt.reference_number, '') = COALESCE(src.reference_number, '')
     AND tgt.created_by IS NOT DISTINCT FROM src.created_by
    WHERE src.status = 'POSTED'
      AND src.type = 'TRANSFER'
      AND public.is_org_in_consolidation_tree(tgt.org_id, src.org_id)
      AND (p_org_id IS NULL OR src.org_id = p_org_id OR tgt.org_id = p_org_id)
  ),
  updated_journal AS (
    UPDATE public.journal_entries je
    SET reference_type = 'BANK_TRANSFER'
    FROM interorg_source src
    WHERE je.reference_id = src.source_tx_id
      AND je.reference_type = 'CASH_OUT'
      AND (p_org_id IS NULL OR je.org_id = p_org_id)
    RETURNING je.id
  )
  SELECT COUNT(*) INTO v_retyped_interorg_journal_count FROM updated_journal;

  RETURN jsonb_build_object(
    'success', TRUE,
    'fixed_bank_tx_branch_count', v_fixed_bank_tx_branch_count,
    'fixed_journal_branch_count', v_fixed_journal_branch_count,
    'linked_existing_journal_count', v_linked_existing_journal_count,
    'created_journal_count', v_created_journal_count,
    'skipped_count', v_skipped_count,
    'noop_posting_count', v_noop_posting_count,
    'retyped_interorg_source_count', v_retyped_interorg_source_count,
    'retyped_interorg_journal_count', v_retyped_interorg_journal_count
  );
END;
$$;


ALTER FUNCTION "public"."repair_bank_transaction_report_sync"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_org_data"("p_org_id" "uuid", "p_mode" "text" DEFAULT 'transactions'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_mode TEXT := COALESCE(NULLIF(trim(p_mode), ''), 'transactions');
BEGIN
  SELECT role INTO v_user_role
  FROM public.org_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id
    AND is_active = TRUE
  LIMIT 1;

  IF v_user_role <> 'owner' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Unauthorized: only owner can reset data.');
  END IF;

  IF v_mode NOT IN ('transactions', 'all_data') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid reset mode.');
  END IF;

  DELETE FROM public.approval_requests WHERE org_id = p_org_id;
  DELETE FROM public.intercompany_transactions WHERE org_id = p_org_id;
  DELETE FROM public.bank_mutations WHERE org_id = p_org_id;
  DELETE FROM public.bank_transactions WHERE org_id = p_org_id;
  DELETE FROM public.inventory_transfers WHERE org_id = p_org_id;
  DELETE FROM public.inventory_adjustments WHERE org_id = p_org_id;
  DELETE FROM public.payroll_runs WHERE org_id = p_org_id;
  DELETE FROM public.expense_claims WHERE org_id = p_org_id;
  DELETE FROM public.reimbursements WHERE org_id = p_org_id;
  DELETE FROM public.attendance WHERE org_id = p_org_id;
  DELETE FROM public.leave_requests WHERE org_id = p_org_id;
  DELETE FROM public.fleet_tickets WHERE org_id = p_org_id;
  DELETE FROM public.fleet_schedules WHERE org_id = p_org_id;
  DELETE FROM public.fleet_bookings WHERE org_id = p_org_id;
  DELETE FROM public.fleet_maintenance_labs WHERE org_id = p_org_id;
  DELETE FROM public.service_orders WHERE org_id = p_org_id;
  DELETE FROM public.purchase_requests WHERE org_id = p_org_id;
  DELETE FROM public.production_work_orders WHERE org_id = p_org_id;
  DELETE FROM public.zakat_asset_timeline WHERE org_id = p_org_id;
  DELETE FROM public.zakat_haul_events WHERE org_id = p_org_id;
  DELETE FROM public.zakat_haul WHERE org_id = p_org_id;
  DELETE FROM public.budgets WHERE org_id = p_org_id;
  DELETE FROM public.fiscal_periods WHERE org_id = p_org_id;
  DELETE FROM public.fixed_assets WHERE org_id = p_org_id;
  DELETE FROM public.sales_returns WHERE org_id = p_org_id;
  DELETE FROM public.purchase_returns WHERE org_id = p_org_id;
  DELETE FROM public.sales_payments WHERE org_id = p_org_id;
  DELETE FROM public.purchase_payments WHERE org_id = p_org_id;
  DELETE FROM public.journal_entries WHERE org_id = p_org_id;
  DELETE FROM public.sales WHERE org_id = p_org_id;
  DELETE FROM public.purchases WHERE org_id = p_org_id;
  DELETE FROM public.stock_movements WHERE org_id = p_org_id;
  DELETE FROM public.inventory_stocks WHERE org_id = p_org_id;
  DELETE FROM public.audit_logs WHERE org_id = p_org_id;

  IF v_mode = 'all_data' THEN
    DELETE FROM public.org_invitations WHERE org_id = p_org_id;
    DELETE FROM public.bank_accounts WHERE org_id = p_org_id;
    DELETE FROM public.payroll_components WHERE org_id = p_org_id;
    DELETE FROM public.employees WHERE org_id = p_org_id;
    DELETE FROM public.fleet_routes WHERE org_id = p_org_id;
    DELETE FROM public.fleet_assets WHERE org_id = p_org_id;
    DELETE FROM public.fleet_terminals WHERE org_id = p_org_id;
    DELETE FROM public.production_boms WHERE org_id = p_org_id;
    DELETE FROM public.production_operations WHERE org_id = p_org_id;
    DELETE FROM public.intercompany_accounts WHERE org_id = p_org_id;
    DELETE FROM public.warehouse_bins WHERE org_id = p_org_id;
    DELETE FROM public.warehouses WHERE org_id = p_org_id;
    IF to_regclass('public.branches') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.branches WHERE org_id = $1' USING p_org_id;
    END IF;
    DELETE FROM public.products WHERE org_id = p_org_id;
    DELETE FROM public.contacts WHERE org_id = p_org_id;
  END IF;

  INSERT INTO public.audit_logs (org_id, user_id, action, table_name, record_id, new_data, user_agent)
  VALUES (
    p_org_id,
    v_user_id,
    'DELETE',
    'SYSTEM_RESET',
    p_org_id,
    jsonb_build_object(
      'mode', v_mode,
      'status', 'SUCCESS',
      'preserved', ARRAY['organizations', 'org_members', 'roles', 'accounts', 'saas_*']
    ),
    'NIZAM ERP System'
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'mode', v_mode,
    'message', CASE
      WHEN v_mode = 'all_data' THEN 'Operational and master data reset complete.'
      ELSE 'Transactional data reset complete.'
    END
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$_$;


ALTER FUNCTION "public"."reset_org_data"("p_org_id" "uuid", "p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_inventory_asset_account"("p_org_id" "uuid", "p_product_id" "uuid", "p_fallback_code" "text" DEFAULT '1301'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_account_id UUID;
  v_fallback_code TEXT := p_fallback_code;
  v_is_bom_component BOOLEAN := FALSE;
  v_is_bom_output BOOLEAN := FALSE;
BEGIN
  SELECT asset_account_id
  INTO v_account_id
  FROM public.products
  WHERE id = p_product_id
    AND org_id = p_org_id
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.production_bom_items bi
    JOIN public.production_boms b ON b.id = bi.bom_id
    WHERE bi.product_id = p_product_id
      AND b.org_id = p_org_id
  )
  INTO v_is_bom_component;

  SELECT EXISTS (
    SELECT 1
    FROM public.production_boms b
    WHERE b.org_id = p_org_id
      AND b.product_id = p_product_id
  )
  INTO v_is_bom_output;

  IF v_is_bom_component AND v_is_bom_output THEN
    v_fallback_code := '1302'; -- WIP / setengah jadi
  ELSIF v_is_bom_component THEN
    v_fallback_code := '1303'; -- bahan baku
  ELSIF v_is_bom_output THEN
    v_fallback_code := '1304'; -- barang jadi
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND code = v_fallback_code
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  SELECT id
  INTO v_account_id
  FROM public.accounts
  WHERE org_id = p_org_id
    AND type = 'ASSET'
  ORDER BY code
  LIMIT 1;

  RETURN v_account_id;
END;
$$;


ALTER FUNCTION "public"."resolve_inventory_asset_account"("p_org_id" "uuid", "p_product_id" "uuid", "p_fallback_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_single_active_branch"("p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    CASE
      WHEN COUNT(*) = 1 THEN MIN(id::text)::UUID
      ELSE NULL
    END
  FROM public.branches
  WHERE org_id = p_org_id
    AND is_active = TRUE;
$$;


ALTER FUNCTION "public"."resolve_single_active_branch"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_single_active_warehouse"("p_org_id" "uuid", "p_branch_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT CASE
    WHEN COUNT(*) = 1 THEN MIN(id::text)::UUID
    ELSE NULL
  END
  FROM public.warehouses
  WHERE org_id = p_org_id
    AND is_active = TRUE
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);
$$;


ALTER FUNCTION "public"."resolve_single_active_warehouse"("p_org_id" "uuid", "p_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_stock_movement_branch_id"("p_reference_type" "text", "p_reference_id" "uuid", "p_warehouse_id" "uuid" DEFAULT NULL::"uuid", "p_org_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  IF p_warehouse_id IS NOT NULL THEN
    SELECT branch_id INTO v_branch_id
    FROM public.warehouses
    WHERE id = p_warehouse_id;

    IF v_branch_id IS NOT NULL THEN
      RETURN v_branch_id;
    END IF;
  END IF;

  CASE UPPER(COALESCE(p_reference_type, ''))
    WHEN 'PURCHASE' THEN
      SELECT branch_id INTO v_branch_id
      FROM public.purchases
      WHERE id = p_reference_id;

    WHEN 'PURCHASE_RETURN' THEN
      SELECT p.branch_id INTO v_branch_id
      FROM public.purchase_returns pr
      JOIN public.purchases p ON p.id = pr.purchase_id
      WHERE pr.id = p_reference_id;

    WHEN 'SALE' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.sales_items
      WHERE sale_id = p_reference_id
        AND branch_id IS NOT NULL;

    WHEN 'SALES_RETURN' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT si.branch_id) = 1 THEN MIN(si.branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.sales_return_items sri
      JOIN public.sales_items si ON si.id = sri.sale_item_id
      WHERE sri.return_id = p_reference_id
        AND si.branch_id IS NOT NULL;

    WHEN 'ADJUSTMENT' THEN
      SELECT
        CASE
          WHEN COUNT(DISTINCT w.branch_id) = 1 THEN MIN(w.branch_id::text)::UUID
          ELSE NULL
        END
      INTO v_branch_id
      FROM public.inventory_adjustment_items iai
      JOIN public.warehouses w ON w.id = iai.warehouse_id
      WHERE iai.adjustment_id = p_reference_id
        AND w.branch_id IS NOT NULL;

    WHEN 'PRODUCTION_OUTPUT' THEN
      SELECT branch_id INTO v_branch_id
      FROM public.production_work_orders
      WHERE id = p_reference_id;

      IF v_branch_id IS NULL THEN
        SELECT
          CASE
            WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
            ELSE NULL
          END
        INTO v_branch_id
        FROM public.stock_movements
        WHERE reference_id = p_reference_id
          AND reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
          AND branch_id IS NOT NULL;
      END IF;

    WHEN 'PRODUCTION_CONSUMPTION' THEN
      SELECT branch_id INTO v_branch_id
      FROM public.production_work_orders
      WHERE id = p_reference_id;

      IF v_branch_id IS NULL THEN
        SELECT
          CASE
            WHEN COUNT(DISTINCT branch_id) = 1 THEN MIN(branch_id::text)::UUID
            ELSE NULL
          END
        INTO v_branch_id
        FROM public.stock_movements
        WHERE reference_id = p_reference_id
          AND reference_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION')
          AND branch_id IS NOT NULL;
      END IF;

    ELSE
      v_branch_id := NULL;
  END CASE;

  IF v_branch_id IS NULL AND p_org_id IS NOT NULL THEN
    v_branch_id := public.resolve_single_active_branch(p_org_id);
  END IF;

  RETURN v_branch_id;
END;
$$;


ALTER FUNCTION "public"."resolve_stock_movement_branch_id"("p_reference_type" "text", "p_reference_id" "uuid", "p_warehouse_id" "uuid", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_coa"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_parent_id UUID;
BEGIN
  -- ══════════════════════════════════════════
  -- 1. ASET (ASSET / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '1000', 'Aset', 'ASSET', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  -- 1.1 Aset Lancar
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '1100', 'Aset Lancar', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1101', 'Kas Besar', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1102', 'Kas Kecil (Petty Cash)', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1103', 'Bank - Rekening Operasional', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1104', 'Bank - Rekening Payroll', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1105', 'Bank - Rekening Lainnya', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1201', 'Piutang Usaha', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1202', 'Piutang Karyawan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1203', 'Cadangan Kerugian Piutang', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1301', 'Persediaan Barang Dagangan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1302', 'Persediaan Barang Dalam Proses', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1401', 'PPN Masukan (Pajak Dibayar)', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1402', 'Biaya Dibayar Dimuka', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1403', 'Uang Muka Pembelian', 'ASSET', 'DEBIT', v_parent_id, TRUE);

  -- 1.2 Aset Tetap
  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '1500', 'Aset Tetap', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1501', 'Tanah', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1502', 'Bangunan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1503', 'Akumulasi Penyusutan Bangunan', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1504', 'Kendaraan', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1505', 'Akumulasi Penyusutan Kendaraan', 'ASSET', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '1506', 'Peralatan & Mesin', 'ASSET', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '1507', 'Akumulasi Penyusutan Peralatan', 'ASSET', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 2. LIABILITAS (LIABILITY / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '2000', 'Liabilitas', 'LIABILITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '2101', 'Hutang Usaha', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2102', 'Hutang Bank Jangka Pendek', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2201', 'PPN Keluaran (Pajak Dipungut)', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2202', 'Hutang PPh 21', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2203', 'Hutang PPh 23', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2204', 'Hutang PPh Badan', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2301', 'Pendapatan Diterima di Muka', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2302', 'Uang Muka Penjualan', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2401', 'Hutang Gaji', 'LIABILITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '2501', 'Hutang Bank Jangka Panjang', 'LIABILITY', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 3. EKUITAS (EQUITY / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '3000', 'Ekuitas', 'EQUITY', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '3001', 'Modal Disetor', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3002', 'Laba Ditahan', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3003', 'Laba Periode Berjalan', 'EQUITY', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '3004', 'Prive / Dividen', 'EQUITY', 'DEBIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 4. PENDAPATAN (REVENUE / CREDIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '4000', 'Pendapatan', 'REVENUE', 'CREDIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '4001', 'Pendapatan Usaha', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '4002', 'Diskon Penjualan (Contra)', 'REVENUE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '4003', 'Retur Penjualan', 'REVENUE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '4101', 'Pendapatan Bunga', 'REVENUE', 'CREDIT', v_parent_id, TRUE),
  (p_org_id, '4102', 'Pendapatan Lain-lain', 'REVENUE', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 5. BEBAN POKOK (COGS / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '5000', 'Beban Pokok Penjualan', 'EXPENSE', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '5001', 'HPP / Cost of Goods Sold', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '5002', 'Biaya Pengiriman Masuk (Freight In)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '5003', 'Retur Pembelian (Contra)', 'EXPENSE', 'CREDIT', v_parent_id, TRUE);

  -- ══════════════════════════════════════════
  -- 6. BEBAN OPERASIONAL (EXPENSE / DEBIT)
  -- ══════════════════════════════════════════
  INSERT INTO accounts (org_id, code, name, type, normal_balance, is_system) VALUES
  (p_org_id, '6000', 'Beban Operasional', 'EXPENSE', 'DEBIT', TRUE)
  RETURNING id INTO v_parent_id;

  INSERT INTO accounts (org_id, code, name, type, normal_balance, parent_id, is_system) VALUES
  (p_org_id, '6001', 'Gaji & Tunjangan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6002', 'Sewa Tempat', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6003', 'Utilitas (Listrik, Air, Internet)', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6004', 'Perlengkapan Kantor', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6005', 'Biaya Pemasaran & Iklan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6006', 'Biaya Transportasi', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6007', 'Biaya Perbaikan & Pemeliharaan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6008', 'Biaya Asuransi', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6009', 'Biaya Penyusutan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6010', 'Biaya Profesional & Konsultan', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6099', 'Beban Lain-lain', 'EXPENSE', 'DEBIT', v_parent_id, TRUE),
  (p_org_id, '6101', 'Biaya Bunga Pinjaman', 'EXPENSE', 'DEBIT', v_parent_id, TRUE);

END;
$$;


ALTER FUNCTION "public"."seed_default_coa"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_roles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Manager role
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Manager', ARRAY[
    'accounting:read', 'accounting:write',
    'inventory:read', 'inventory:write',
    'sales:read', 'sales:write',
    'purchasing:read', 'purchasing:write',
    'reports:read'
  ], TRUE);

  -- Staff role (limited)
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Staff', ARRAY[
    'accounting:read',
    'inventory:read',
    'sales:read', 'sales:write',
    'purchasing:read'
  ], TRUE);

  -- Viewer role (read-only)
  INSERT INTO roles (org_id, name, permissions, is_system) VALUES
  (NEW.id, 'Viewer', ARRAY[
    'accounting:read',
    'inventory:read',
    'reports:read'
  ], TRUE);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."seed_default_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_adj_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_suffix TEXT;
BEGIN
  -- Generate nomor baru dengan timestamp presisi tinggi + random hash
  -- Format: ADJ-YYMMDD-HHMMSS-XXXXXX (Mustahil duplikat)
  v_suffix := UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT), 1, 6));
  NEW.adj_number := 'ADJ-' || TO_CHAR(NOW(), 'YYMMDD-HH24MISS') || '-' || v_suffix;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_adj_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_asset_depreciation_log_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_asset_org_id UUID;
  v_asset_branch_id UUID;
BEGIN
  SELECT org_id, branch_id
  INTO v_asset_org_id, v_asset_branch_id
  FROM public.fixed_assets
  WHERE id = NEW.asset_id;

  IF v_asset_org_id IS NULL OR v_asset_branch_id IS NULL THEN
    RAISE EXCEPTION 'Aset untuk log penyusutan tidak valid.';
  END IF;

  NEW.org_id := v_asset_org_id;
  NEW.branch_id := v_asset_branch_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_asset_depreciation_log_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_attendance_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_branch_id UUID;
BEGIN
  SELECT branch_id INTO v_branch_id
  FROM public.employees
  WHERE id = NEW.employee_id
    AND org_id = NEW.org_id;

  NEW.branch_id := COALESCE(v_branch_id, NEW.branch_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_attendance_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_bank_account_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF NEW.branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank account on organization %', NEW.org_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = NEW.branch_id
      AND b.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_bank_account_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_bank_mutation_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_bank_account_branch_id UUID;
BEGIN
  SELECT branch_id
  INTO v_bank_account_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id
    AND org_id = NEW.org_id;

  IF v_bank_account_branch_id IS NULL THEN
    v_bank_account_branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF v_bank_account_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank mutation on organization %', NEW.org_id;
  END IF;

  IF NEW.branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_bank_account_branch_id THEN
    RAISE EXCEPTION 'bank mutation branch % does not match bank account branch %', NEW.branch_id, v_bank_account_branch_id;
  END IF;

  NEW.branch_id := v_bank_account_branch_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_bank_mutation_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_bank_transaction_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_bank_account_branch_id UUID;
BEGIN
  SELECT branch_id
  INTO v_bank_account_branch_id
  FROM public.bank_accounts
  WHERE id = NEW.bank_account_id
    AND org_id = NEW.org_id;

  IF v_bank_account_branch_id IS NULL THEN
    v_bank_account_branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF v_bank_account_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required for bank transaction on organization %', NEW.org_id;
  END IF;

  IF NEW.branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_bank_account_branch_id THEN
    RAISE EXCEPTION 'bank transaction branch % does not match bank account branch %', NEW.branch_id, v_bank_account_branch_id;
  END IF;

  NEW.branch_id := v_bank_account_branch_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_bank_transaction_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_budget_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_resolved_branch_id UUID;
BEGIN
  IF NEW.branch_id IS NULL THEN
    v_resolved_branch_id := public.resolve_single_active_branch(NEW.org_id);

    IF v_resolved_branch_id IS NOT NULL THEN
      NEW.branch_id := v_resolved_branch_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_budget_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_default_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.get_default_branch_id(NEW.org_id);
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.branches b
       WHERE b.id = NEW.branch_id
         AND b.org_id = NEW.org_id
     ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_default_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_entry_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.entry_number IS NULL OR NEW.entry_number = '' THEN
    NEW.entry_number = generate_entry_number(NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_entry_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_expense_claim_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_employee_org_id UUID;
  v_employee_branch_id UUID;
BEGIN
  SELECT org_id, branch_id
  INTO v_employee_org_id, v_employee_branch_id
  FROM public.employees
  WHERE id = NEW.employee_id;

  IF v_employee_org_id IS NULL THEN
    RAISE EXCEPTION 'Employee % not found.', NEW.employee_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := v_employee_org_id;
  END IF;

  IF NEW.org_id <> v_employee_org_id THEN
    RAISE EXCEPTION 'Employee % does not belong to org %.', NEW.employee_id, NEW.org_id;
  END IF;

  IF v_employee_branch_id IS NULL THEN
    v_employee_branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF v_employee_branch_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve branch for employee %.', NEW.employee_id;
  END IF;

  NEW.branch_id := v_employee_branch_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_expense_claim_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_fleet_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_branch_id UUID;
  v_route_branch_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'fleet_bookings' THEN
    SELECT branch_id INTO v_branch_id
    FROM public.fleet_assets
    WHERE id = NEW.asset_id
      AND org_id = NEW.org_id;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'Armada tidak ditemukan atau belum memiliki unit.';
    END IF;

    NEW.branch_id := v_branch_id;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'fleet_schedules' THEN
    SELECT branch_id INTO v_branch_id
    FROM public.fleet_assets
    WHERE id = NEW.asset_id
      AND org_id = NEW.org_id;

    SELECT branch_id INTO v_route_branch_id
    FROM public.fleet_routes
    WHERE id = NEW.route_id
      AND org_id = NEW.org_id;

    IF v_branch_id IS NULL OR v_route_branch_id IS NULL THEN
      RAISE EXCEPTION 'Rute atau armada tidak ditemukan atau belum memiliki unit.';
    END IF;

    IF v_branch_id IS DISTINCT FROM v_route_branch_id THEN
      RAISE EXCEPTION 'Rute dan armada harus berada pada unit yang sama.';
    END IF;

    NEW.branch_id := v_branch_id;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'fleet_tickets' THEN
    SELECT branch_id INTO v_branch_id
    FROM public.fleet_schedules
    WHERE id = NEW.schedule_id
      AND org_id = NEW.org_id;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'Jadwal tidak ditemukan atau belum memiliki unit.';
    END IF;

    NEW.branch_id := v_branch_id;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'fleet_maintenance_labs' THEN
    SELECT branch_id INTO v_branch_id
    FROM public.fleet_assets
    WHERE id = NEW.asset_id
      AND org_id = NEW.org_id;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'Armada tidak ditemukan atau belum memiliki unit.';
    END IF;

    NEW.branch_id := v_branch_id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_fleet_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_journal_entry_default_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.get_default_branch_id(NEW.org_id);
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.branches b
       WHERE b.id = NEW.branch_id
         AND b.org_id = NEW.org_id
     ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_journal_entry_default_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_leave_request_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_employee_org_id UUID;
  v_employee_branch_id UUID;
BEGIN
  SELECT org_id, branch_id
  INTO v_employee_org_id, v_employee_branch_id
  FROM public.employees
  WHERE id = NEW.employee_id;

  IF v_employee_org_id IS NULL THEN
    RAISE EXCEPTION 'Employee % not found.', NEW.employee_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := v_employee_org_id;
  END IF;

  IF NEW.org_id <> v_employee_org_id THEN
    RAISE EXCEPTION 'Employee % does not belong to org %.', NEW.employee_id, NEW.org_id;
  END IF;

  IF v_employee_branch_id IS NULL THEN
    v_employee_branch_id := public.resolve_single_active_branch(NEW.org_id);
  END IF;

  IF v_employee_branch_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve branch for employee %.', NEW.employee_id;
  END IF;

  NEW.branch_id := v_employee_branch_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_leave_request_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_purchase_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.purchase_number IS NULL OR NEW.purchase_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM purchases WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.purchase_number = 'PO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_purchase_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_request_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM purchase_requests WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.request_number = 'PR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_request_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_sale_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_count FROM sales WHERE org_id = NEW.org_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    NEW.sale_number = 'SO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_sale_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_sale_warehouse_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_warehouse_org_id UUID;
  v_warehouse_branch_id UUID;
  v_warehouse_is_active BOOLEAN;
BEGIN
  IF NEW.warehouse_id IS NULL THEN
    NEW.warehouse_id := public.resolve_single_active_warehouse(NEW.org_id, NEW.branch_id);
  END IF;

  IF NEW.warehouse_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT org_id, branch_id, is_active
  INTO v_warehouse_org_id, v_warehouse_branch_id, v_warehouse_is_active
  FROM public.warehouses
  WHERE id = NEW.warehouse_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gudang pengiriman % tidak ditemukan.', NEW.warehouse_id;
  END IF;

  IF v_warehouse_org_id IS DISTINCT FROM NEW.org_id THEN
    RAISE EXCEPTION 'Gudang % tidak berada pada organisasi %.', NEW.warehouse_id, NEW.org_id;
  END IF;

  IF v_warehouse_is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Gudang % sudah tidak aktif.', NEW.warehouse_id;
  END IF;

  IF NEW.branch_id IS NOT NULL AND v_warehouse_branch_id IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'Gudang % tidak berada pada unit yang sama dengan sales order.', NEW.warehouse_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_sale_warehouse_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_sales_item_branch_context"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sale_org_id UUID;
  v_sale_branch_id UUID;
BEGIN
  SELECT s.org_id, s.branch_id
  INTO v_sale_org_id, v_sale_branch_id
  FROM public.sales s
  WHERE s.id = NEW.sale_id;

  IF v_sale_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.org_id IS DISTINCT FROM v_sale_org_id THEN
    RAISE EXCEPTION 'sale_id % tidak valid untuk organisasi %', NEW.sale_id, NEW.org_id;
  END IF;

  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := COALESCE(v_sale_branch_id, public.get_default_branch_id(NEW.org_id));
  END IF;

  IF v_sale_branch_id IS NOT NULL AND NEW.branch_id IS DISTINCT FROM v_sale_branch_id THEN
    RAISE EXCEPTION 'branch_id sales item % harus sama dengan branch sales %', NEW.branch_id, v_sale_branch_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_sales_item_branch_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_stock_movement_branch_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    NEW.branch_id := public.resolve_stock_movement_branch_id(
      NEW.reference_type,
      NEW.reference_id,
      NULL,
      NEW.org_id
    );
  END IF;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE id = NEW.branch_id
      AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'branch_id % tidak valid untuk organisasi %', NEW.branch_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_stock_movement_branch_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_transfer_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.transfer_number IS NULL OR NEW.transfer_number = '' THEN
    SELECT COUNT(*) + 1
      INTO v_count
      FROM public.inventory_transfers
     WHERE org_id = NEW.org_id
       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    NEW.transfer_number := 'TRF-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_transfer_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_coa_request"("p_business_reason" "text", "p_parent_org_id" "uuid", "p_proposed_code" "text", "p_proposed_description" "text" DEFAULT NULL::"text", "p_proposed_name" "text" DEFAULT NULL::"text", "p_proposed_normal_balance" "text" DEFAULT NULL::"text", "p_proposed_parent_id" "uuid" DEFAULT NULL::"uuid", "p_proposed_type" "text" DEFAULT NULL::"text", "p_requester_branch_id" "uuid" DEFAULT NULL::"uuid", "p_requester_org_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_request_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;

  IF p_business_reason IS NULL OR trim(p_business_reason) = '' THEN
    RAISE EXCEPTION 'Alasan bisnis wajib diisi saat mengajukan request rekening CoA.';
  END IF;

  IF p_proposed_code IS NULL OR trim(p_proposed_code) = '' THEN
    RAISE EXCEPTION 'Kode akun yang diajukan wajib diisi.';
  END IF;

  IF p_proposed_name IS NULL OR trim(p_proposed_name) = '' THEN
    RAISE EXCEPTION 'Nama akun yang diajukan wajib diisi.';
  END IF;

  IF p_proposed_type IS NULL THEN
    RAISE EXCEPTION 'Tipe akun yang diajukan wajib diisi.';
  END IF;

  IF p_proposed_normal_balance IS NULL THEN
    RAISE EXCEPTION 'Saldo normal akun yang diajukan wajib diisi.';
  END IF;

  INSERT INTO public.coa_account_requests (
    org_id,
    requester_org_id,
    requester_branch_id,
    requested_by,
    proposed_code,
    proposed_name,
    proposed_type,
    proposed_normal_balance,
    proposed_parent_id,
    proposed_description,
    business_reason
  ) VALUES (
    p_parent_org_id,
    p_requester_org_id,
    p_requester_branch_id,
    auth.uid(),
    trim(p_proposed_code),
    trim(p_proposed_name),
    p_proposed_type,
    p_proposed_normal_balance,
    p_proposed_parent_id,
    p_proposed_description,
    trim(p_business_reason)
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;


ALTER FUNCTION "public"."submit_coa_request"("p_business_reason" "text", "p_parent_org_id" "uuid", "p_proposed_code" "text", "p_proposed_description" "text", "p_proposed_name" "text", "p_proposed_normal_balance" "text", "p_proposed_parent_id" "uuid", "p_proposed_type" "text", "p_requester_branch_id" "uuid", "p_requester_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_bsc_cycle_scope_key"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.branch_scope_key := COALESCE(NEW.branch_id::TEXT, 'ALL');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_bsc_cycle_scope_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_parent_roles_to_child_org"("p_parent_org_id" "uuid", "p_child_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_parent_org_parent_id UUID;
  v_child_org_parent_id UUID;
  v_parent_role RECORD;
  v_target_role_id UUID;
  v_target_parent_id UUID;
  v_conflict_role_id UUID;
  v_target_name TEXT;
BEGIN
  IF p_parent_org_id IS NULL OR p_child_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT o.parent_org_id
    INTO v_parent_org_parent_id
  FROM public.organizations o
  WHERE o.id = p_parent_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent organization % tidak ditemukan.', p_parent_org_id;
  END IF;

  IF v_parent_org_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Organisasi sumber % bukan holding/root.', p_parent_org_id;
  END IF;

  SELECT o.parent_org_id
    INTO v_child_org_parent_id
  FROM public.organizations o
  WHERE o.id = p_child_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child organization % tidak ditemukan.', p_child_org_id;
  END IF;

  IF v_child_org_parent_id IS DISTINCT FROM p_parent_org_id THEN
    RAISE EXCEPTION 'Organisasi % bukan child langsung dari %.', p_child_org_id, p_parent_org_id;
  END IF;

  -- Pass 1: upsert role rows (without parent relation first)
  FOR v_parent_role IN
    SELECT
      r.id,
      r.name,
      COALESCE(r.permissions, '{}'::TEXT[]) AS permissions,
      COALESCE(r.is_system, FALSE) AS is_system,
      COALESCE(r.priority, 999) AS priority,
      r.department_id,
      COALESCE(r.department_ids, '{}'::TEXT[]) AS department_ids
    FROM public.roles r
    WHERE r.org_id = p_parent_org_id
    ORDER BY COALESCE(r.priority, 999), r.name, r.id
  LOOP
    v_target_role_id := NULL;
    v_conflict_role_id := NULL;
    v_target_name := v_parent_role.name;

    -- Strong mapping first
    SELECT r.id
      INTO v_target_role_id
    FROM public.roles r
    WHERE r.org_id = p_child_org_id
      AND r.source_role_id = v_parent_role.id
    LIMIT 1;

    -- Fallback to existing unmapped role by case-insensitive name
    IF v_target_role_id IS NULL THEN
      SELECT r.id
        INTO v_target_role_id
      FROM public.roles r
      WHERE r.org_id = p_child_org_id
        AND r.source_role_id IS NULL
        AND LOWER(TRIM(r.name)) = LOWER(TRIM(v_parent_role.name))
      ORDER BY r.created_at ASC
      LIMIT 1;
    END IF;

    IF v_target_role_id IS NULL THEN
      INSERT INTO public.roles (
        org_id,
        name,
        permissions,
        is_system,
        priority,
        department_id,
        department_ids,
        parent_id,
        source_org_id,
        source_role_id
      )
      VALUES (
        p_child_org_id,
        v_parent_role.name,
        v_parent_role.permissions,
        v_parent_role.is_system,
        v_parent_role.priority,
        v_parent_role.department_id,
        v_parent_role.department_ids,
        NULL,
        p_parent_org_id,
        v_parent_role.id
      )
      RETURNING id INTO v_target_role_id;
    ELSE
      -- Keep existing child name when rename collides with another child role.
      SELECT r.id
        INTO v_conflict_role_id
      FROM public.roles r
      WHERE r.org_id = p_child_org_id
        AND r.id <> v_target_role_id
        AND LOWER(TRIM(r.name)) = LOWER(TRIM(v_parent_role.name))
      ORDER BY r.created_at ASC
      LIMIT 1;

      IF v_conflict_role_id IS NOT NULL THEN
        SELECT r.name
          INTO v_target_name
        FROM public.roles r
        WHERE r.id = v_target_role_id
        LIMIT 1;
      END IF;

      UPDATE public.roles
      SET
        name = COALESCE(v_target_name, v_parent_role.name),
        permissions = v_parent_role.permissions,
        is_system = v_parent_role.is_system,
        priority = v_parent_role.priority,
        department_id = v_parent_role.department_id,
        department_ids = v_parent_role.department_ids,
        source_org_id = p_parent_org_id,
        source_role_id = v_parent_role.id
      WHERE id = v_target_role_id;
    END IF;
  END LOOP;

  -- Pass 2: parent hierarchy mapping
  FOR v_parent_role IN
    SELECT r.id, r.parent_id
    FROM public.roles r
    WHERE r.org_id = p_parent_org_id
  LOOP
    SELECT r.id
      INTO v_target_role_id
    FROM public.roles r
    WHERE r.org_id = p_child_org_id
      AND r.source_role_id = v_parent_role.id
    LIMIT 1;

    IF v_target_role_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_parent_role.parent_id IS NULL THEN
      v_target_parent_id := NULL;
    ELSE
      SELECT r.id
        INTO v_target_parent_id
      FROM public.roles r
      WHERE r.org_id = p_child_org_id
        AND r.source_role_id = v_parent_role.parent_id
      LIMIT 1;
    END IF;

    UPDATE public.roles
    SET parent_id = v_target_parent_id
    WHERE id = v_target_role_id;
  END LOOP;

  -- Any previously-synced role whose source no longer exists in parent is detached.
  UPDATE public.roles r
  SET
    source_org_id = NULL,
    source_role_id = NULL,
    parent_id = NULL
  WHERE r.org_id = p_child_org_id
    AND r.source_org_id = p_parent_org_id
    AND r.source_role_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.roles pr
      WHERE pr.org_id = p_parent_org_id
        AND pr.id = r.source_role_id
    );
END;
$$;


ALTER FUNCTION "public"."sync_parent_roles_to_child_org"("p_parent_org_id" "uuid", "p_child_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_parent_roles_to_children"("p_parent_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_child RECORD;
BEGIN
  IF p_parent_org_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_child IN
    SELECT o.id
    FROM public.organizations o
    WHERE o.parent_org_id = p_parent_org_id
      AND COALESCE(o.is_active, TRUE) = TRUE
  LOOP
    PERFORM public.sync_parent_roles_to_child_org(p_parent_org_id, v_child.id);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."sync_parent_roles_to_children"("p_parent_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_coa_request_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_coa_request_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_sync_parent_roles_after_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org_id UUID := COALESCE(NEW.org_id, OLD.org_id);
  v_parent_org_id UUID;
BEGIN
  IF v_org_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT o.parent_org_id
    INTO v_parent_org_id
  FROM public.organizations o
  WHERE o.id = v_org_id
  LIMIT 1;

  -- Only holding/root roles propagate.
  IF NOT FOUND OR v_parent_org_id IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  PERFORM public.sync_parent_roles_to_children(v_org_id);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_sync_parent_roles_after_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_seed_coa"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if skip flag is set in settings JSONB
  IF (NEW.settings->>'skip_coa_seed') = 'true' THEN
    RETURN NEW;
  END IF;

  PERFORM public.seed_default_coa(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_seed_coa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_seed_inventory_segment_accounts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.ensure_inventory_segment_accounts(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_seed_inventory_segment_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_journal_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_debit  NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Only validate when posting (status changing to POSTED)
  IF NEW.status = 'POSTED' AND OLD.status != 'POSTED' THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_lines
    WHERE entry_id = NEW.id;

    -- Must have at least 2 lines
    IF (SELECT COUNT(*) FROM journal_lines WHERE entry_id = NEW.id) < 2 THEN
      RAISE EXCEPTION 'Journal entry must have at least 2 lines';
    END IF;

    -- Debit must equal credit
    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
      RAISE EXCEPTION 'Journal entry is not balanced: debit=% credit=%',
        v_total_debit, v_total_credit;
    END IF;

    -- Set posted_at timestamp
    NEW.posted_at = NOW();
  END IF;

  -- Voided entries cannot be modified
  IF OLD.status = 'VOIDED' THEN
    RAISE EXCEPTION 'Cannot modify a voided journal entry';
  END IF;

  -- Posted entries: only allow status change to VOIDED
  IF OLD.status = 'POSTED' AND NEW.status NOT IN ('VOIDED', 'POSTED') THEN
    RAISE EXCEPTION 'Cannot change a posted entry back to draft';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_journal_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_journal_balance_on_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Hanya validate saat transisi ke POSTED
  IF NEW.status = 'POSTED' AND (OLD.status IS DISTINCT FROM 'POSTED') THEN
    SELECT 
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_lines
    WHERE entry_id = NEW.id;

    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
      RAISE EXCEPTION 'LEDGER INTEGRITY VIOLATION: Jurnal % tidak balance. Debit: %, Credit: %. Selisih: %',
        NEW.id, v_total_debit, v_total_credit, ABS(v_total_debit - v_total_credit);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_journal_balance_on_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_payroll_run"("p_run_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_je_id UUID;
BEGIN
    SELECT journal_entry_id INTO v_je_id FROM payroll_runs WHERE id = p_run_id;
    
    -- 1. Void Journal Entry if exists
    IF v_je_id IS NOT NULL THEN
        UPDATE journal_entries SET status = 'VOIDED' WHERE id = v_je_id;
    END IF;

    -- 2. Reset Run & Payslips
    UPDATE payroll_runs SET status = 'DRAFT', journal_entry_id = NULL WHERE id = p_run_id;
    UPDATE payslips SET payment_status = 'UNPAID' WHERE run_id = p_run_id;
END;
$$;


ALTER FUNCTION "public"."void_payroll_run"("p_run_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_purchase_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.journal_entries SET status = 'VOIDED', voided_at = NOW(), voided_by = p_user_id, void_reason = p_reason
    WHERE reference_id = p_purchase_id AND reference_type = 'PURCHASE';

    -- Hapus kartu stok (Sekarang tabelnya sudah ada)
    DELETE FROM public.stock_movements WHERE reference_id = p_purchase_id AND reference_type = 'PURCHASE';

    UPDATE public.purchases SET status = 'VOIDED' WHERE id = p_purchase_id;

    RETURN jsonb_build_object('success', TRUE);
END;
$$;


ALTER FUNCTION "public"."void_purchase_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."custom_oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "acceptable_client_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pkce_enabled" boolean DEFAULT true NOT NULL,
    "attribute_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "authorization_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "email_optional" boolean DEFAULT false NOT NULL,
    "issuer" "text",
    "discovery_url" "text",
    "skip_nonce_check" boolean DEFAULT false NOT NULL,
    "cached_discovery" "jsonb",
    "discovery_cached_at" timestamp with time zone,
    "authorization_url" "text",
    "token_url" "text",
    "userinfo_url" "text",
    "jwks_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_oauth_providers_authorization_url_https" CHECK ((("authorization_url" IS NULL) OR ("authorization_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_authorization_url_length" CHECK ((("authorization_url" IS NULL) OR ("char_length"("authorization_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_client_id_length" CHECK ((("char_length"("client_id") >= 1) AND ("char_length"("client_id") <= 512))),
    CONSTRAINT "custom_oauth_providers_discovery_url_length" CHECK ((("discovery_url" IS NULL) OR ("char_length"("discovery_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_identifier_format" CHECK (("identifier" ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::"text")),
    CONSTRAINT "custom_oauth_providers_issuer_length" CHECK ((("issuer" IS NULL) OR (("char_length"("issuer") >= 1) AND ("char_length"("issuer") <= 2048)))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_https" CHECK ((("jwks_uri" IS NULL) OR ("jwks_uri" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_length" CHECK ((("jwks_uri" IS NULL) OR ("char_length"("jwks_uri") <= 2048))),
    CONSTRAINT "custom_oauth_providers_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "custom_oauth_providers_oauth2_requires_endpoints" CHECK ((("provider_type" <> 'oauth2'::"text") OR (("authorization_url" IS NOT NULL) AND ("token_url" IS NOT NULL) AND ("userinfo_url" IS NOT NULL)))),
    CONSTRAINT "custom_oauth_providers_oidc_discovery_url_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("discovery_url" IS NULL) OR ("discovery_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_issuer_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NULL) OR ("issuer" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_requires_issuer" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NOT NULL))),
    CONSTRAINT "custom_oauth_providers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['oauth2'::"text", 'oidc'::"text"]))),
    CONSTRAINT "custom_oauth_providers_token_url_https" CHECK ((("token_url" IS NULL) OR ("token_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_token_url_length" CHECK ((("token_url" IS NULL) OR ("char_length"("token_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_https" CHECK ((("userinfo_url" IS NULL) OR ("userinfo_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_length" CHECK ((("userinfo_url" IS NULL) OR ("char_length"("userinfo_url") <= 2048)))
);


ALTER TABLE "auth"."custom_oauth_providers" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';



CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "auth"."webauthn_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_type" "text" NOT NULL,
    "session_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "webauthn_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['signup'::"text", 'registration'::"text", 'authentication'::"text"])))
);


ALTER TABLE "auth"."webauthn_challenges" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "bytea" NOT NULL,
    "public_key" "bytea" NOT NULL,
    "attestation_type" "text" DEFAULT ''::"text" NOT NULL,
    "aaguid" "uuid",
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "transports" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "backup_eligible" boolean DEFAULT false NOT NULL,
    "backed_up" boolean DEFAULT false NOT NULL,
    "friendly_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "auth"."webauthn_credentials" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."account_type" NOT NULL,
    "normal_balance" "public"."normal_balance" NOT NULL,
    "parent_id" "uuid",
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cash_flow_category" "text",
    "managed_branch_id" "uuid" NOT NULL,
    CONSTRAINT "accounts_cash_flow_category_check" CHECK (("cash_flow_category" = ANY (ARRAY['OPERATING'::"text", 'INVESTING'::"text", 'FINANCING'::"text"])))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "entry_number" "text" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text" NOT NULL,
    "reference_type" "public"."journal_reference_type" DEFAULT 'MANUAL'::"public"."journal_reference_type" NOT NULL,
    "reference_id" "uuid",
    "status" "public"."journal_status" DEFAULT 'DRAFT'::"public"."journal_status" NOT NULL,
    "is_auto" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "posted_at" timestamp with time zone,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "debit" numeric(20,2) DEFAULT 0 NOT NULL,
    "credit" numeric(20,2) DEFAULT 0 NOT NULL,
    "memo" "text",
    CONSTRAINT "chk_debit_or_credit" CHECK ((("debit" > (0)::numeric) OR ("credit" > (0)::numeric))),
    CONSTRAINT "chk_not_both" CHECK ((NOT (("debit" > (0)::numeric) AND ("credit" > (0)::numeric)))),
    CONSTRAINT "journal_lines_credit_check" CHECK (("credit" >= (0)::numeric)),
    CONSTRAINT "journal_lines_debit_check" CHECK (("debit" >= (0)::numeric))
);


ALTER TABLE "public"."journal_lines" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."account_balances" AS
 SELECT "a"."org_id",
    "a"."id" AS "account_id",
    "a"."code",
    "a"."name",
    "a"."type",
    "a"."normal_balance",
    COALESCE("sum"(
        CASE
            WHEN ("je"."status" = 'POSTED'::"public"."journal_status") THEN "jl"."debit"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_debit",
    COALESCE("sum"(
        CASE
            WHEN ("je"."status" = 'POSTED'::"public"."journal_status") THEN "jl"."credit"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_credit",
        CASE
            WHEN ("a"."normal_balance" = 'DEBIT'::"public"."normal_balance") THEN (COALESCE("sum"(
            CASE
                WHEN ("je"."status" = 'POSTED'::"public"."journal_status") THEN "jl"."debit"
                ELSE (0)::numeric
            END), (0)::numeric) - COALESCE("sum"(
            CASE
                WHEN ("je"."status" = 'POSTED'::"public"."journal_status") THEN "jl"."credit"
                ELSE (0)::numeric
            END), (0)::numeric))
            ELSE (COALESCE("sum"(
            CASE
                WHEN ("je"."status" = 'POSTED'::"public"."journal_status") THEN "jl"."credit"
                ELSE (0)::numeric
            END), (0)::numeric) - COALESCE("sum"(
            CASE
                WHEN ("je"."status" = 'POSTED'::"public"."journal_status") THEN "jl"."debit"
                ELSE (0)::numeric
            END), (0)::numeric))
        END AS "balance"
   FROM (("public"."accounts" "a"
     LEFT JOIN "public"."journal_lines" "jl" ON (("jl"."account_id" = "a"."id")))
     LEFT JOIN "public"."journal_entries" "je" ON (("je"."id" = "jl"."entry_id")))
  WHERE ("a"."is_active" = true)
  GROUP BY "a"."org_id", "a"."id", "a"."code", "a"."name", "a"."type", "a"."normal_balance";


ALTER VIEW "public"."account_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_token_topup_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "tokens" bigint NOT NULL,
    "price_idr" numeric(14,2) NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_token_topup_orders_price_idr_check" CHECK (("price_idr" >= (0)::numeric)),
    CONSTRAINT "ai_token_topup_orders_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'PAID'::"text", 'CANCELLED'::"text", 'EXPIRED'::"text"]))),
    CONSTRAINT "ai_token_topup_orders_tokens_check" CHECK (("tokens" > 0))
);


ALTER TABLE "public"."ai_token_topup_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_token_topup_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "tokens" bigint NOT NULL,
    "price_idr" numeric(14,2) NOT NULL,
    "cost_idr" numeric(14,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_token_topup_packages_cost_idr_check" CHECK (("cost_idr" >= (0)::numeric)),
    CONSTRAINT "ai_token_topup_packages_price_idr_check" CHECK (("price_idr" >= (0)::numeric)),
    CONSTRAINT "ai_token_topup_packages_tokens_check" CHECK (("tokens" > 0))
);


ALTER TABLE "public"."ai_token_topup_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_token_usage_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "source" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "tokens" bigint NOT NULL,
    "estimated_cost_idr" numeric(14,2) DEFAULT 0 NOT NULL,
    "related_invoice_id" "uuid",
    "note" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_token_usage_logs_direction_check" CHECK (("direction" = ANY (ARRAY['DEBIT'::"text", 'CREDIT'::"text"]))),
    CONSTRAINT "ai_token_usage_logs_source_check" CHECK (("source" = ANY (ARRAY['sales_page_generate'::"text", 'topup'::"text", 'manual_adjustment'::"text", 'refund'::"text"]))),
    CONSTRAINT "ai_token_usage_logs_tokens_check" CHECK (("tokens" > 0))
);


ALTER TABLE "public"."ai_token_usage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_token_wallets" (
    "org_id" "uuid" NOT NULL,
    "balance_tokens" bigint DEFAULT 0 NOT NULL,
    "total_purchased_tokens" bigint DEFAULT 0 NOT NULL,
    "total_used_tokens" bigint DEFAULT 0 NOT NULL,
    "low_balance_threshold" bigint DEFAULT 5000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_token_wallets_balance_tokens_check" CHECK (("balance_tokens" >= 0)),
    CONSTRAINT "ai_token_wallets_low_balance_threshold_check" CHECK (("low_balance_threshold" >= 0)),
    CONSTRAINT "ai_token_wallets_total_purchased_tokens_check" CHECK (("total_purchased_tokens" >= 0)),
    CONSTRAINT "ai_token_wallets_total_used_tokens_check" CHECK (("total_used_tokens" >= 0))
);


ALTER TABLE "public"."ai_token_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "approver_id" "uuid",
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "status" "public"."approval_status" DEFAULT 'PENDING'::"public"."approval_status" NOT NULL,
    "reason" "text",
    "notes" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."approval_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_depreciation_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "period_date" "date" NOT NULL,
    "amount" numeric(19,4) NOT NULL,
    "journal_entry_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."asset_depreciation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "record_date" "date" NOT NULL,
    "check_in" timestamp with time zone,
    "check_out" timestamp with time zone,
    "status" "public"."attendance_status" DEFAULT 'ABSENT'::"public"."attendance_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "bank_name" "text" NOT NULL,
    "account_number" "text",
    "account_holder" "text",
    "currency" "text" DEFAULT 'IDR'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_mutations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "mutation_date" "date" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(20,2) NOT NULL,
    "type" "public"."cash_transaction_type" NOT NULL,
    "balance" numeric(20,2),
    "is_matched" boolean DEFAULT false NOT NULL,
    "transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."bank_mutations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "transaction_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(20,2) NOT NULL,
    "type" "public"."cash_transaction_type" NOT NULL,
    "reference_number" "text",
    "category_id" "uuid",
    "journal_entry_id" "uuid",
    "status" "text" DEFAULT 'POSTED'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    CONSTRAINT "bank_transactions_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."bank_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."bank_branch_backfill_audit" AS
 SELECT "bank_accounts"."org_id",
    'bank_accounts'::"text" AS "table_name",
    "count"(*) AS "unresolved_count"
   FROM "public"."bank_accounts"
  WHERE ("bank_accounts"."branch_id" IS NULL)
  GROUP BY "bank_accounts"."org_id"
UNION ALL
 SELECT "bank_transactions"."org_id",
    'bank_transactions'::"text" AS "table_name",
    "count"(*) AS "unresolved_count"
   FROM "public"."bank_transactions"
  WHERE ("bank_transactions"."branch_id" IS NULL)
  GROUP BY "bank_transactions"."org_id"
UNION ALL
 SELECT "bank_mutations"."org_id",
    'bank_mutations'::"text" AS "table_name",
    "count"(*) AS "unresolved_count"
   FROM "public"."bank_mutations"
  WHERE ("bank_mutations"."branch_id" IS NULL)
  GROUP BY "bank_mutations"."org_id";


ALTER VIEW "public"."bank_branch_backfill_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pic_employee_id" "uuid"
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bsc_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "branch_scope_key" "text" DEFAULT 'ALL'::"text" NOT NULL,
    "cycle_key" "text" NOT NULL,
    "cycle_name" "text" NOT NULL,
    "period_type" "text" DEFAULT 'MONTHLY'::"text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bsc_cycles_date_check" CHECK (("start_date" <= "end_date")),
    CONSTRAINT "bsc_cycles_period_type_check" CHECK (("period_type" = ANY (ARRAY['MONTHLY'::"text", 'QUARTERLY'::"text", 'YEARLY'::"text", 'CUSTOM'::"text"]))),
    CONSTRAINT "bsc_cycles_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."bsc_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bsc_kpi_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "kpi_id" "uuid" NOT NULL,
    "measurement_date" "date" NOT NULL,
    "actual_value" numeric(19,4) NOT NULL,
    "achievement_percent" numeric(7,2) DEFAULT 0 NOT NULL,
    "score_100" numeric(7,2) DEFAULT 0 NOT NULL,
    "score_4" numeric(6,3) DEFAULT 0 NOT NULL,
    "note" "text",
    "measured_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bsc_kpi_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bsc_kpis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "perspective" "text" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "unit" "text",
    "direction" "text" DEFAULT 'HIGHER_BETTER'::"text" NOT NULL,
    "weight_percent" numeric(5,2) NOT NULL,
    "target_value" numeric(19,4) NOT NULL,
    "baseline_value" numeric(19,4),
    "source_type" "text" DEFAULT 'MANUAL'::"text" NOT NULL,
    "formula_key" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bsc_kpis_direction_check" CHECK (("direction" = ANY (ARRAY['HIGHER_BETTER'::"text", 'LOWER_BETTER'::"text"]))),
    CONSTRAINT "bsc_kpis_name_check" CHECK (("perspective" = ANY (ARRAY['FINANCIAL'::"text", 'CUSTOMER'::"text", 'INTERNAL_PROCESS'::"text", 'LEARNING_GROWTH'::"text"]))),
    CONSTRAINT "bsc_kpis_source_check" CHECK (("source_type" = ANY (ARRAY['AUTO'::"text", 'MANUAL'::"text"]))),
    CONSTRAINT "bsc_kpis_weight_check" CHECK ((("weight_percent" >= (0)::numeric) AND ("weight_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."bsc_kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bsc_perspective_weights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid" NOT NULL,
    "perspective" "text" NOT NULL,
    "weight_percent" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bsc_perspective_weights_name_check" CHECK (("perspective" = ANY (ARRAY['FINANCIAL'::"text", 'CUSTOMER'::"text", 'INTERNAL_PROCESS'::"text", 'LEARNING_GROWTH'::"text"]))),
    CONSTRAINT "bsc_perspective_weights_value_check" CHECK ((("weight_percent" >= (0)::numeric) AND ("weight_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."bsc_perspective_weights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "period" "date" NOT NULL,
    "budget_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_demo" boolean DEFAULT false,
    "parent_org_id" "uuid",
    "active_addons" "jsonb" DEFAULT '[]'::"jsonb",
    "owner_email" "text",
    "manager_employee_id" "uuid"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."budget_branch_backfill_audit" AS
 WITH "active_branch_counts" AS (
         SELECT "b"."org_id",
            "count"(*) FILTER (WHERE ("b"."is_active" = true)) AS "active_branch_count"
           FROM "public"."branches" "b"
          GROUP BY "b"."org_id"
        )
 SELECT "bud"."org_id",
    "org"."name" AS "org_name",
    COALESCE("abc"."active_branch_count", (0)::bigint) AS "active_branch_count",
    "count"(*) AS "unresolved_budget_count"
   FROM (("public"."budgets" "bud"
     LEFT JOIN "public"."organizations" "org" ON (("org"."id" = "bud"."org_id")))
     LEFT JOIN "active_branch_counts" "abc" ON (("abc"."org_id" = "bud"."org_id")))
  WHERE ("bud"."branch_id" IS NULL)
  GROUP BY "bud"."org_id", "org"."name", "abc"."active_branch_count"
  ORDER BY ("count"(*)) DESC, "org"."name";


ALTER VIEW "public"."budget_branch_backfill_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coa_account_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "requester_org_id" "uuid" NOT NULL,
    "requester_branch_id" "uuid",
    "requested_by" "uuid" NOT NULL,
    "proposed_code" "text" NOT NULL,
    "proposed_name" "text" NOT NULL,
    "proposed_type" "text" NOT NULL,
    "proposed_normal_balance" "text" NOT NULL,
    "proposed_parent_id" "uuid",
    "proposed_description" "text",
    "business_reason" "text" NOT NULL,
    "status" "public"."coa_request_status" DEFAULT 'pending'::"public"."coa_request_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coa_account_requests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."coa_request_summary" AS
 SELECT "r"."id",
    "r"."org_id",
    "r"."requester_org_id",
    "o_req"."name" AS "requester_org_name",
    "r"."requester_branch_id",
    "b"."name" AS "requester_branch_name",
    "r"."requested_by",
    "r"."proposed_code",
    "r"."proposed_name",
    "r"."proposed_type",
    "r"."proposed_normal_balance",
    "r"."proposed_description",
    "r"."business_reason",
    "r"."status",
    "r"."reviewed_by",
    "r"."reviewed_at",
    "r"."review_notes",
    "r"."created_account_id",
    "a"."code" AS "created_account_code",
    "a"."name" AS "created_account_name",
    "r"."created_at",
    "r"."updated_at"
   FROM ((("public"."coa_account_requests" "r"
     LEFT JOIN "public"."organizations" "o_req" ON (("o_req"."id" = "r"."requester_org_id")))
     LEFT JOIN "public"."branches" "b" ON (("b"."id" = "r"."requester_branch_id")))
     LEFT JOIN "public"."accounts" "a" ON (("a"."id" = "r"."created_account_id")));


ALTER VIEW "public"."coa_request_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "phone_wa" "text",
    "instagram" "text"
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_components" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "component_id" "uuid" NOT NULL,
    "amount" numeric(20,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "nik" character varying(50) NOT NULL,
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100),
    "email" character varying(255),
    "phone" character varying(50),
    "date_of_birth" "date",
    "gender" character varying(20),
    "marital_status" character varying(50),
    "tax_status" character varying(20),
    "job_title" character varying(100) NOT NULL,
    "department" character varying(100),
    "join_date" "date" NOT NULL,
    "end_date" "date",
    "employment_status" "public"."employment_status" DEFAULT 'FULL_TIME'::"public"."employment_status" NOT NULL,
    "bank_name" character varying(100),
    "bank_account_number" character varying(100),
    "bank_account_holder" character varying(100),
    "basic_salary" numeric(20,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "license_number" "text",
    "license_expiry" "date",
    "blood_type" character varying(5),
    "registration_status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "department_ids" "public"."nizam_department"[] DEFAULT '{}'::"public"."nizam_department"[],
    "reset_requested" boolean DEFAULT false,
    "reset_requested_at" timestamp with time zone,
    "whatsapp" character varying(100),
    "avatar_url" "text",
    "branch_id" "uuid"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


COMMENT ON TABLE "public"."employees" IS 'Master data karyawan untuk HRIS dan Payroll.';



CREATE TABLE IF NOT EXISTS "public"."expense_claims" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "claim_date" "date" NOT NULL,
    "category" character varying(50) NOT NULL,
    "amount" numeric(20,2) NOT NULL,
    "description" "text" NOT NULL,
    "receipt_url" "text",
    "status" "public"."leave_status" DEFAULT 'PENDING'::"public"."leave_status" NOT NULL,
    "approved_by" "uuid",
    "journal_entry_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."expense_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."expense_claims" IS 'Klaim pengeluaran / reimbursement karyawan.';



CREATE TABLE IF NOT EXISTS "public"."production_work_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "bom_id" "uuid" NOT NULL,
    "wo_number" "text" NOT NULL,
    "quantity_planned" numeric(20,4) DEFAULT 1 NOT NULL,
    "quantity_actual" numeric(20,4) DEFAULT 0,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "released_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "deadline_date" "date"
);


ALTER TABLE "public"."production_work_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "movement_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quantity" numeric(15,2) NOT NULL,
    "unit_price" numeric(15,2) NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_id" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."factory_branch_backfill_audit" AS
 SELECT 'production_work_orders'::"text" AS "source_table",
    "wo"."org_id",
    NULL::"text" AS "reference_type",
    "count"(*) AS "unresolved_count"
   FROM "public"."production_work_orders" "wo"
  WHERE ("wo"."branch_id" IS NULL)
  GROUP BY "wo"."org_id"
UNION ALL
 SELECT 'journal_entries'::"text" AS "source_table",
    "wo"."org_id",
    'PRODUCTION'::"text" AS "reference_type",
    "count"(*) AS "unresolved_count"
   FROM ("public"."journal_entries" "je"
     JOIN "public"."production_work_orders" "wo" ON (("wo"."id" = "je"."reference_id")))
  WHERE (("je"."reference_type" = 'PRODUCTION'::"public"."journal_reference_type") AND (("wo"."branch_id" IS NULL) OR ("je"."branch_id" IS DISTINCT FROM "wo"."branch_id")))
  GROUP BY "wo"."org_id"
UNION ALL
 SELECT 'stock_movements'::"text" AS "source_table",
    "wo"."org_id",
    "sm"."reference_type",
    "count"(*) AS "unresolved_count"
   FROM ("public"."stock_movements" "sm"
     JOIN "public"."production_work_orders" "wo" ON (("wo"."id" = "sm"."reference_id")))
  WHERE (("sm"."reference_type" = ANY (ARRAY['PRODUCTION_OUTPUT'::"text", 'PRODUCTION_CONSUMPTION'::"text"])) AND (("wo"."branch_id" IS NULL) OR ("sm"."branch_id" IS DISTINCT FROM "wo"."branch_id")))
  GROUP BY "wo"."org_id", "sm"."reference_type";


ALTER VIEW "public"."factory_branch_backfill_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fiscal_periods" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_closed" boolean DEFAULT false NOT NULL,
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fiscal_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fixed_assets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "purchase_date" "date" NOT NULL,
    "purchase_price" numeric(19,4) DEFAULT 0 NOT NULL,
    "salvage_value" numeric(19,4) DEFAULT 0 NOT NULL,
    "useful_life_months" integer DEFAULT 0 NOT NULL,
    "asset_account_id" "uuid",
    "accum_dep_account_id" "uuid",
    "dep_expense_account_id" "uuid",
    "depreciation_method" "public"."depreciation_method" DEFAULT 'STRAIGHT_LINE'::"public"."depreciation_method" NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "accumulated_depreciation" numeric(19,4) DEFAULT 0 NOT NULL,
    "current_book_value" numeric(19,4) DEFAULT 0 NOT NULL,
    "last_depreciation_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "acquisition_method" "text" DEFAULT 'LUNAS'::"text",
    "source_account_id" "uuid",
    "branch_id" "uuid" NOT NULL,
    "should_capitalize_tax" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."fixed_assets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."fixed_asset_branch_backfill_audit" AS
 SELECT 'fixed_assets'::"text" AS "source_table",
    "fa"."org_id",
    NULL::"text" AS "reference_type",
    "count"(*) AS "unresolved_count"
   FROM "public"."fixed_assets" "fa"
  WHERE ("fa"."branch_id" IS NULL)
  GROUP BY "fa"."org_id"
UNION ALL
 SELECT 'asset_depreciation_logs'::"text" AS "source_table",
    "adl"."org_id",
    NULL::"text" AS "reference_type",
    "count"(*) AS "unresolved_count"
   FROM "public"."asset_depreciation_logs" "adl"
  WHERE ("adl"."branch_id" IS NULL)
  GROUP BY "adl"."org_id"
UNION ALL
 SELECT 'journal_entries'::"text" AS "source_table",
    "fa"."org_id",
    ("je"."reference_type")::"text" AS "reference_type",
    "count"(*) AS "unresolved_count"
   FROM ("public"."journal_entries" "je"
     JOIN "public"."fixed_assets" "fa" ON (("fa"."id" = "je"."reference_id")))
  WHERE (("je"."reference_type" = ANY (ARRAY['ADJUSTMENT'::"public"."journal_reference_type", 'DEPRECIATION'::"public"."journal_reference_type"])) AND ("je"."branch_id" IS DISTINCT FROM "fa"."branch_id"))
  GROUP BY "fa"."org_id", "je"."reference_type";


ALTER VIEW "public"."fixed_asset_branch_backfill_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_assets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "plate_number" "text" NOT NULL,
    "model" "text" NOT NULL,
    "brand" "text",
    "type" "public"."fleet_type" DEFAULT 'CAR'::"public"."fleet_type" NOT NULL,
    "status" "public"."fleet_status" DEFAULT 'AVAILABLE'::"public"."fleet_status" NOT NULL,
    "odometer" numeric(20,2) DEFAULT 0,
    "daily_rate" numeric(20,2) DEFAULT 0,
    "notes" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "capacity" integer DEFAULT 40,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fleet_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_bookings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "status" "public"."booking_status" DEFAULT 'RESERVED'::"public"."booking_status" NOT NULL,
    "total_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "deposit" numeric(20,2) DEFAULT 0,
    "payment_status" "text" DEFAULT 'UNPAID'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fleet_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_maintenance_labs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "service_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text" NOT NULL,
    "cost" numeric(20,2) DEFAULT 0 NOT NULL,
    "odometer_at" numeric(20,2),
    "next_service_km" numeric(20,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fleet_maintenance_labs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_routes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "distance_km" numeric(10,2),
    "base_price" numeric(20,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fleet_routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_schedules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "route_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "driver_id" "uuid",
    "departure_time" timestamp with time zone NOT NULL,
    "arrival_time" timestamp with time zone,
    "status" "public"."schedule_status" DEFAULT 'SCHEDULED'::"public"."schedule_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "helper_id" "uuid",
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fleet_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_terminals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location_name" "text",
    "gps_coords" "text",
    "radius_meters" integer DEFAULT 200,
    "qr_code_token" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fleet_terminals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_tickets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "passenger_id" "uuid" NOT NULL,
    "seat_number" "text" NOT NULL,
    "price" numeric(20,2) DEFAULT 0 NOT NULL,
    "status" "public"."ticket_status" DEFAULT 'BOOKED'::"public"."ticket_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."fleet_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intercompany_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "due_from_account_id" "uuid",
    "due_to_account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intercompany_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."intercompany_accounts" IS 'Mapping akun GL untuk transaksi antar-cabang. 
   "Due From" (Piutang Cabang A ke B) harus di-eliminate saat konsolidasi 
   agar tidak menggembungkan total aset konsolidasi secara semu.';



CREATE TABLE IF NOT EXISTS "public"."intercompany_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "from_branch_id" "uuid",
    "to_branch_id" "uuid",
    "journal_entry_id" "uuid",
    "amount" numeric(20,2) NOT NULL,
    "description" "text",
    "transaction_date" "date" NOT NULL,
    "is_eliminated" boolean DEFAULT false NOT NULL,
    "eliminated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intercompany_transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."intercompany_transactions"."is_eliminated" IS 'Flag eliminasi untuk konsolidasi. Jika TRUE, transaksi ini dikecualikan dari 
   laporan konsolidasi agar laba tidak membengkak semu (CTO requirement).';



CREATE TABLE IF NOT EXISTS "public"."inventory_adjustment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "adjustment_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid",
    "actual_quantity" numeric(20,4) DEFAULT 0 NOT NULL,
    "diff_quantity" numeric(20,4) NOT NULL,
    "unit_cost" numeric(20,2) NOT NULL,
    "total_value" numeric(20,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_adjustment_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "adj_number" "text",
    "adj_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "type" "public"."inventory_adjustment_type" DEFAULT 'STOCK_COUNT'::"public"."inventory_adjustment_type" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "total_value" numeric(20,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "journal_entry_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."warehouses" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."inventory_branch_backfill_audit" AS
 SELECT 'warehouses'::"text" AS "source_table",
    "w"."org_id",
    NULL::"text" AS "reference_type",
    "count"(*) AS "unresolved_count"
   FROM "public"."warehouses" "w"
  WHERE ("w"."branch_id" IS NULL)
  GROUP BY "w"."org_id"
UNION ALL
 SELECT 'stock_movements'::"text" AS "source_table",
    "sm"."org_id",
    "sm"."reference_type",
    "count"(*) AS "unresolved_count"
   FROM "public"."stock_movements" "sm"
  WHERE ("sm"."branch_id" IS NULL)
  GROUP BY "sm"."org_id", "sm"."reference_type";


ALTER VIEW "public"."inventory_branch_backfill_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_stocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "quantity" numeric(20,4) DEFAULT 0 NOT NULL,
    "batch_number" "text",
    "expiry_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid",
    "bin_id" "uuid"
);


ALTER TABLE "public"."inventory_stocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transfer_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "transfer_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(20,4) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_transfer_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "transfer_number" "text" NOT NULL,
    "transfer_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "source_wh_id" "uuid" NOT NULL,
    "target_wh_id" "uuid" NOT NULL,
    "notes" "text",
    "status" "public"."document_status" DEFAULT 'DRAFT'::"public"."document_status" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_transfers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."journal_entry_branch_backfill_audit" AS
 WITH "active_branch_counts" AS (
         SELECT "b"."org_id",
            "count"(*) FILTER (WHERE ("b"."is_active" = true)) AS "active_branch_count"
           FROM "public"."branches" "b"
          GROUP BY "b"."org_id"
        )
 SELECT "je"."org_id",
    "o"."name" AS "org_name",
    COALESCE("abc"."active_branch_count", (0)::bigint) AS "active_branch_count",
    "count"(*) AS "unresolved_journal_count"
   FROM (("public"."journal_entries" "je"
     LEFT JOIN "public"."organizations" "o" ON (("o"."id" = "je"."org_id")))
     LEFT JOIN "active_branch_counts" "abc" ON (("abc"."org_id" = "je"."org_id")))
  WHERE ("je"."branch_id" IS NULL)
  GROUP BY "je"."org_id", "o"."name", "abc"."active_branch_count"
  ORDER BY ("count"(*)) DESC, "o"."name";


ALTER VIEW "public"."journal_entry_branch_backfill_audit" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."journal_entry_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."journal_entry_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "leave_type" character varying(50) NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "days_taken" numeric(5,1) NOT NULL,
    "reason" "text" NOT NULL,
    "status" "public"."leave_status" DEFAULT 'PENDING'::"public"."leave_status" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."leave_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" DEFAULT 'staff'::"public"."member_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role_id" "uuid",
    "last_active_at" timestamp with time zone,
    "last_active_branch_id" "uuid"
);


ALTER TABLE "public"."org_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leave_approval_backfill_audit" AS
 WITH "missing_leave_approvals" AS (
         SELECT "lr"."id" AS "leave_id",
            "lr"."org_id",
            "lr"."branch_id",
            "lr"."employee_id",
            "lr"."leave_type",
            "lr"."start_date",
            "lr"."end_date",
            "lr"."reason",
            "lr"."status",
            "lr"."created_at",
            "lr"."updated_at",
            "lr"."approved_at",
            "lr"."approved_by",
            "e"."user_id" AS "employee_user_id",
            ( SELECT "om"."user_id"
                   FROM "public"."org_members" "om"
                  WHERE (("om"."org_id" = "lr"."org_id") AND ("om"."is_active" = true) AND ("om"."user_id" IS NOT NULL) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role", 'manager'::"public"."member_role"])))
                  ORDER BY
                        CASE "om"."role"
                            WHEN 'owner'::"public"."member_role" THEN 1
                            WHEN 'admin'::"public"."member_role" THEN 2
                            WHEN 'hr'::"public"."member_role" THEN 3
                            WHEN 'manager'::"public"."member_role" THEN 4
                            ELSE 5
                        END, "om"."joined_at"
                 LIMIT 1) AS "elevated_member_user_id",
            ( SELECT "om"."user_id"
                   FROM "public"."org_members" "om"
                  WHERE (("om"."org_id" = "lr"."org_id") AND ("om"."is_active" = true) AND ("om"."user_id" IS NOT NULL))
                  ORDER BY "om"."joined_at"
                 LIMIT 1) AS "fallback_member_user_id"
           FROM (("public"."leave_requests" "lr"
             JOIN "public"."employees" "e" ON (("e"."id" = "lr"."employee_id")))
             LEFT JOIN "public"."approval_requests" "ar" ON ((("ar"."org_id" = "lr"."org_id") AND ("ar"."source_type" = 'LEAVE_REQUEST'::"text") AND ("ar"."source_id" = "lr"."id"))))
          WHERE ("ar"."id" IS NULL)
        )
 SELECT "leave_id",
    "org_id",
    "branch_id",
    "employee_id",
    "leave_type",
    "start_date",
    "end_date",
    "reason",
    "status",
    "created_at",
    "updated_at",
    "approved_at",
    "approved_by",
    "employee_user_id",
    "elevated_member_user_id",
    "fallback_member_user_id",
    COALESCE("employee_user_id", "elevated_member_user_id", "fallback_member_user_id") AS "resolved_requester_id"
   FROM "missing_leave_approvals";


ALTER VIEW "public"."leave_approval_backfill_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_invitations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid",
    "role_id" "uuid",
    "invitation_code" "text" NOT NULL,
    "label" "text",
    "max_uses" integer DEFAULT 0,
    "use_count" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."org_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_member_units" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_member_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."org_member_units" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."orphan_journal_entry_audit" AS
 SELECT "je"."org_id",
    "count"(*) AS "orphan_journal_count",
    "count"(*) FILTER (WHERE ("je"."branch_id" IS NULL)) AS "orphan_null_branch_count",
    "min"("je"."created_at") AS "oldest_created_at",
    "max"("je"."created_at") AS "newest_created_at"
   FROM ("public"."journal_entries" "je"
     LEFT JOIN "public"."organizations" "o" ON (("o"."id" = "je"."org_id")))
  WHERE ("o"."id" IS NULL)
  GROUP BY "je"."org_id"
  ORDER BY ("count"(*)) DESC, ("max"("je"."created_at")) DESC;


ALTER VIEW "public"."orphan_journal_entry_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_components" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "type" "public"."payroll_item_type" NOT NULL,
    "is_taxable" boolean DEFAULT true NOT NULL,
    "default_amount" numeric(20,2) DEFAULT 0,
    "is_percentage" boolean DEFAULT false NOT NULL,
    "percentage_value" numeric(5,2),
    "account_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payroll_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "payment_date" "date" NOT NULL,
    "status" "public"."payroll_status" DEFAULT 'DRAFT'::"public"."payroll_status" NOT NULL,
    "journal_entry_id" "uuid",
    "total_gross" numeric(20,2) DEFAULT 0 NOT NULL,
    "total_deductions" numeric(20,2) DEFAULT 0 NOT NULL,
    "total_net" numeric(20,2) DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."payroll_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_runs" IS 'Periode penggajian bulanan atau mingguan.';



CREATE TABLE IF NOT EXISTS "public"."payslip_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payslip_id" "uuid" NOT NULL,
    "component_name" character varying(100) NOT NULL,
    "type" "public"."payroll_item_type" NOT NULL,
    "amount" numeric(20,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "component_id" "uuid",
    "account_id" "uuid"
);


ALTER TABLE "public"."payslip_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payslips" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "basic_salary" numeric(20,2) NOT NULL,
    "net_salary" numeric(20,2) NOT NULL,
    "payment_status" character varying(20) DEFAULT 'UNPAID'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gross_salary" numeric(20,2) DEFAULT 0,
    "total_deductions" numeric(20,2) DEFAULT 0,
    "branch_id" "uuid" NOT NULL
);


ALTER TABLE "public"."payslips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."production_bom_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "bom_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(20,4) DEFAULT 1 NOT NULL,
    "unit" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."production_bom_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."production_boms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."production_boms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."production_wo_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wo_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "cost_type" "text" DEFAULT 'LABOR'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."production_wo_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "sku" "text",
    "name" "text" NOT NULL,
    "type" "public"."product_type" DEFAULT 'INVENTORY'::"public"."product_type" NOT NULL,
    "description" "text",
    "unit" "text" DEFAULT 'Pcs'::"text" NOT NULL,
    "purchase_price" numeric(20,2) DEFAULT 0 NOT NULL,
    "selling_price" numeric(20,2) DEFAULT 0 NOT NULL,
    "asset_account_id" "uuid",
    "income_account_id" "uuid",
    "expense_account_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "average_cost" numeric(15,2) DEFAULT 0,
    "barcode" "text",
    "category" "text" DEFAULT 'Bahan'::"text"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."category" IS 'Kategori internal: Bahan, Setengah Jadi, Barang Jadi';



CREATE TABLE IF NOT EXISTS "public"."purchase_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric(15,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    "total_amount" numeric(15,2) GENERATED ALWAYS AS (((("quantity" * "unit_price") - "discount_amount") + "tax_amount")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "payment_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "amount" numeric(20,2) NOT NULL,
    "discount_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "payment_number" "text" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchase_payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."purchase_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "request_number" "text" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "product_name" "text" NOT NULL,
    "quantity" numeric(20,4) DEFAULT 0 NOT NULL,
    "unit" "text",
    "status" "public"."pr_status" DEFAULT 'PENDING'::"public"."pr_status" NOT NULL,
    "priority" "text" DEFAULT 'NORMAL'::"text",
    "notes" "text",
    "source_type" "text" DEFAULT 'MANUFACTURING'::"text",
    "source_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."purchase_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_return_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "return_id" "uuid" NOT NULL,
    "purchase_item_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(20,2) NOT NULL,
    "unit_price" numeric(20,2) NOT NULL,
    "total_price" numeric(20,2) NOT NULL
);


ALTER TABLE "public"."purchase_return_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "purchase_id" "uuid" NOT NULL,
    "return_number" "text" NOT NULL,
    "return_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "total_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."purchase_returns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "purchase_number" "text" NOT NULL,
    "purchase_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "total_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(20,2) DEFAULT 0 NOT NULL,
    "status" "public"."document_status" DEFAULT 'DRAFT'::"public"."document_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'UNPAID'::"public"."payment_status" NOT NULL,
    "due_date" "date",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "shipping_amount" numeric(20,2) DEFAULT 0,
    "insurance_amount" numeric(20,2) DEFAULT 0,
    "branch_id" "uuid",
    "shariah_mode" "public"."shariah_mode" DEFAULT 'CASH'::"public"."shariah_mode" NOT NULL,
    "warehouse_id" "uuid"
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reimbursements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "claim_number" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "total_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "notes" "text",
    "journal_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid"
);


ALTER TABLE "public"."reimbursements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."reimbursement_branch_backfill_audit" AS
 SELECT "org_id",
    "count"(*) AS "unresolved_count"
   FROM "public"."reimbursements"
  WHERE ("branch_id" IS NULL)
  GROUP BY "org_id"
  ORDER BY ("count"(*)) DESC, "org_id";


ALTER VIEW "public"."reimbursement_branch_backfill_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reimbursement_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reimbursement_id" "uuid" NOT NULL,
    "expense_date" "date" NOT NULL,
    "category_account_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(20,2) NOT NULL,
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reimbursement_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "department_ids" "public"."nizam_department"[] DEFAULT '{}'::"public"."nizam_department"[],
    "priority" integer DEFAULT 0,
    "parent_id" "uuid",
    "source_org_id" "uuid",
    "source_role_id" "uuid"
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saas_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text"
);


ALTER TABLE "public"."saas_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saas_invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid",
    "package_id" "uuid",
    "invoice_number" "text" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "status" "text" DEFAULT 'UNPAID'::"text",
    "payment_method" "text",
    "payment_proof_url" "text",
    "due_date" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "item_name" "text",
    "item_description" "text",
    "discount_percent" numeric(5,2) DEFAULT 0,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "tax_percent" numeric(5,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    CONSTRAINT "saas_invoices_status_check" CHECK (("status" = ANY (ARRAY['UNPAID'::"text", 'PAID'::"text", 'CANCELLED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."saas_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saas_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "price" numeric(15,2) DEFAULT 0 NOT NULL,
    "billing" character varying(50) DEFAULT 'Bulan'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "modules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "addons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "duration_days" integer DEFAULT 30,
    "max_orgs" integer DEFAULT 1,
    "max_warehouses" integer DEFAULT 1,
    "max_branches" integer DEFAULT 1,
    "max_child_orgs" integer DEFAULT 1,
    "max_users" integer DEFAULT 5
);


ALTER TABLE "public"."saas_packages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."saas_packages"."max_branches" IS 'Maksimum cabang yang boleh dibuat per org. NULL = unlimited.';



COMMENT ON COLUMN "public"."saas_packages"."max_child_orgs" IS 'Maksimum anak perusahaan yang boleh ditambahkan per holding. NULL = unlimited.';



COMMENT ON COLUMN "public"."saas_packages"."max_users" IS 'Maksimum pengguna aktif per org. NULL = unlimited.';



CREATE TABLE IF NOT EXISTS "public"."saas_vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "discount_percent" numeric DEFAULT 0,
    "package_id" "uuid",
    "max_uses" integer DEFAULT 1,
    "uses_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saas_vouchers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "sale_number" "text" NOT NULL,
    "sale_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "total_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(20,2) DEFAULT 0 NOT NULL,
    "status" "public"."document_status" DEFAULT 'DRAFT'::"public"."document_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'UNPAID'::"public"."payment_status" NOT NULL,
    "due_date" "date",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid",
    "payment_term" "text" DEFAULT 'TEMPO'::"text",
    "shariah_mode" "text" DEFAULT 'CASH'::"text",
    "warehouse_id" "uuid"
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."sales_delivery_warehouse_audit" AS
 SELECT "s"."org_id",
    "o"."name" AS "org_name",
    "s"."branch_id",
    "count"(*) FILTER (WHERE ("s"."warehouse_id" IS NULL)) AS "unresolved_sales_count",
    "count"(*) FILTER (WHERE (("s"."status" = 'FINISHED'::"public"."document_status") AND ("s"."warehouse_id" IS NULL))) AS "unresolved_finished_sales_count"
   FROM ("public"."sales" "s"
     LEFT JOIN "public"."organizations" "o" ON (("o"."id" = "s"."org_id")))
  GROUP BY "s"."org_id", "o"."name", "s"."branch_id"
  ORDER BY ("count"(*) FILTER (WHERE (("s"."status" = 'FINISHED'::"public"."document_status") AND ("s"."warehouse_id" IS NULL)))) DESC, ("count"(*) FILTER (WHERE ("s"."warehouse_id" IS NULL))) DESC, "o"."name";


ALTER VIEW "public"."sales_delivery_warehouse_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric(15,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    "total_amount" numeric(15,2) GENERATED ALWAYS AS (((("quantity" * "unit_price") - "discount_amount") + "tax_amount")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "branch_id" "uuid"
);


ALTER TABLE "public"."sales_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_page_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "sales_page_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "company" "text",
    "message" "text",
    "status" "text" DEFAULT 'NEW'::"text" NOT NULL,
    "source_url" "text",
    "utm_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_page_leads_status_check" CHECK (("status" = ANY (ARRAY['NEW'::"text", 'CONTACTED'::"text", 'QUALIFIED'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."sales_page_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "offer_badge" "text",
    "headline" "text" NOT NULL,
    "subheadline" "text",
    "description" "text",
    "target_audience" "text",
    "price_label" "text",
    "bonus_text" "text",
    "guarantee_text" "text",
    "urgency_text" "text",
    "hero_image_url" "text",
    "hero_image_alt" "text",
    "primary_cta_label" "text" DEFAULT 'Hubungi Kami'::"text" NOT NULL,
    "primary_cta_url" "text" DEFAULT '#lead-form'::"text" NOT NULL,
    "secondary_cta_label" "text",
    "secondary_cta_url" "text",
    "meta_title" "text",
    "meta_description" "text",
    "meta_pixel_id" "text",
    "theme" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "proof_points" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "benefits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "offer_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "testimonials" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "faq_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "form_settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "template_id" "text" DEFAULT 'LEAD_CAPTURE'::"text" NOT NULL,
    CONSTRAINT "sales_pages_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'PUBLISHED'::"text"]))),
    CONSTRAINT "sales_pages_template_id_check" CHECK (("template_id" = ANY (ARRAY['LEAD_CAPTURE'::"text", 'WEBINAR'::"text", 'PRODUCT_LAUNCH'::"text", 'CONSULTING'::"text"])))
);


ALTER TABLE "public"."sales_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "payment_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "amount" numeric(20,2) NOT NULL,
    "discount_amount" numeric(20,2) DEFAULT 0 NOT NULL,
    "payment_number" "text" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid",
    CONSTRAINT "sales_payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."sales_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_return_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "return_id" "uuid" NOT NULL,
    "sale_item_id" "uuid",
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(15,2) NOT NULL,
    "unit_price" numeric(15,2) NOT NULL,
    "total_price" numeric(15,2) NOT NULL
);


ALTER TABLE "public"."sales_return_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "return_number" "text" NOT NULL,
    "return_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nota_retur_number" "text",
    "status" "text" DEFAULT 'COMPLETED'::"text" NOT NULL,
    "notes" "text",
    "total_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "grand_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "branch_id" "uuid"
);


ALTER TABLE "public"."sales_returns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid",
    "contact_id" "uuid",
    "job_number" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'PENDING'::"text",
    "start_date" timestamp with time zone DEFAULT "now"(),
    "completion_date" timestamp with time zone,
    "estimated_cost" numeric(15,2) DEFAULT 0,
    "actual_cost" numeric(15,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "branch_id" "uuid" NOT NULL,
    CONSTRAINT "service_orders_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'IN_PROGRESS'::"text", 'COMPLETED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."service_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_ticket_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "updated_by_user_id" "uuid" NOT NULL,
    "update_title" "text" NOT NULL,
    "update_body" "text",
    "status_before" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "status_after" "text" DEFAULT 'IN_PROGRESS'::"text" NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_ticket_updates_status_after_check" CHECK (("status_after" = ANY (ARRAY['OPEN'::"text", 'IN_PROGRESS'::"text", 'RESOLVED'::"text", 'CLOSED'::"text"]))),
    CONSTRAINT "support_ticket_updates_status_before_check" CHECK (("status_before" = ANY (ARRAY['OPEN'::"text", 'IN_PROGRESS'::"text", 'RESOLVED'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."support_ticket_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "reporter_user_id" "uuid" NOT NULL,
    "ticket_no" "text" DEFAULT "public"."generate_support_ticket_no"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "severity" "text" DEFAULT 'MEDIUM'::"text" NOT NULL,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "found_in_menu" "text" DEFAULT ''::"text" NOT NULL,
    "found_during" "text",
    "found_at" timestamp with time zone,
    "screenshot_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_tickets_severity_check" CHECK (("severity" = ANY (ARRAY['LOW'::"text", 'MEDIUM'::"text", 'HIGH'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'IN_PROGRESS'::"text", 'RESOLVED'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_ap_aging_report" AS
 WITH "paid_agg" AS (
         SELECT "purchase_payments"."purchase_id",
            COALESCE("sum"(("purchase_payments"."amount" + "purchase_payments"."discount_amount")), (0)::numeric) AS "total_paid"
           FROM "public"."purchase_payments"
          GROUP BY "purchase_payments"."purchase_id"
        ), "return_agg" AS (
         SELECT "purchase_returns"."purchase_id",
            COALESCE("sum"("purchase_returns"."total_amount"), (0)::numeric) AS "total_returned"
           FROM "public"."purchase_returns"
          GROUP BY "purchase_returns"."purchase_id"
        )
 SELECT "pur"."org_id",
    "c"."name" AS "contact_name",
    "pur"."purchase_number" AS "doc_number",
    "pur"."due_date",
    "pur"."grand_total",
    COALESCE("p"."total_paid", (0)::numeric) AS "paid_amount",
    COALESCE("r"."total_returned", (0)::numeric) AS "returned_amount",
    (("pur"."grand_total" - COALESCE("p"."total_paid", (0)::numeric)) - COALESCE("r"."total_returned", (0)::numeric)) AS "outstanding",
    GREATEST(0, (CURRENT_DATE - "pur"."due_date")) AS "days_overdue",
        CASE
            WHEN ("pur"."due_date" >= CURRENT_DATE) THEN 'Current'::"text"
            WHEN ((CURRENT_DATE - "pur"."due_date") <= 30) THEN '0-30 Days'::"text"
            WHEN ((CURRENT_DATE - "pur"."due_date") <= 60) THEN '31-60 Days'::"text"
            WHEN ((CURRENT_DATE - "pur"."due_date") <= 90) THEN '61-90 Days'::"text"
            ELSE '> 90 Days'::"text"
        END AS "aging_bucket"
   FROM ((("public"."purchases" "pur"
     JOIN "public"."contacts" "c" ON (("pur"."vendor_id" = "c"."id")))
     LEFT JOIN "paid_agg" "p" ON (("p"."purchase_id" = "pur"."id")))
     LEFT JOIN "return_agg" "r" ON (("r"."purchase_id" = "pur"."id")))
  WHERE (("pur"."status" <> ALL (ARRAY['DRAFT'::"public"."document_status", 'VOIDED'::"public"."document_status"])) AND ((("pur"."grand_total" - COALESCE("p"."total_paid", (0)::numeric)) - COALESCE("r"."total_returned", (0)::numeric)) > 0.01));


ALTER VIEW "public"."v_ap_aging_report" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_ar_aging_report" AS
 WITH "paid_agg" AS (
         SELECT "sales_payments"."sale_id",
            COALESCE("sum"("sales_payments"."amount"), (0)::numeric) AS "total_paid"
           FROM "public"."sales_payments"
          GROUP BY "sales_payments"."sale_id"
        ), "return_agg" AS (
         SELECT "sales_returns"."sale_id",
            COALESCE("sum"("sales_returns"."grand_total"), (0)::numeric) AS "total_returned"
           FROM "public"."sales_returns"
          WHERE ("sales_returns"."status" <> 'VOIDED'::"text")
          GROUP BY "sales_returns"."sale_id"
        )
 SELECT "s"."org_id",
    "c"."name" AS "contact_name",
    "s"."sale_number" AS "doc_number",
    "s"."due_date",
    "s"."grand_total",
    COALESCE("p"."total_paid", (0)::numeric) AS "paid_amount",
    COALESCE("r"."total_returned", (0)::numeric) AS "returned_amount",
    (("s"."grand_total" - COALESCE("p"."total_paid", (0)::numeric)) - COALESCE("r"."total_returned", (0)::numeric)) AS "outstanding",
    GREATEST(0, (CURRENT_DATE - "s"."due_date")) AS "days_overdue",
        CASE
            WHEN ("s"."due_date" >= CURRENT_DATE) THEN 'Current'::"text"
            WHEN ((CURRENT_DATE - "s"."due_date") <= 30) THEN '0-30 Days'::"text"
            WHEN ((CURRENT_DATE - "s"."due_date") <= 60) THEN '31-60 Days'::"text"
            WHEN ((CURRENT_DATE - "s"."due_date") <= 90) THEN '61-90 Days'::"text"
            ELSE '> 90 Days'::"text"
        END AS "aging_bucket"
   FROM ((("public"."sales" "s"
     JOIN "public"."contacts" "c" ON (("s"."customer_id" = "c"."id")))
     LEFT JOIN "paid_agg" "p" ON (("p"."sale_id" = "s"."id")))
     LEFT JOIN "return_agg" "r" ON (("r"."sale_id" = "s"."id")))
  WHERE (("s"."status" <> ALL (ARRAY['DRAFT'::"public"."document_status", 'VOIDED'::"public"."document_status"])) AND ((("s"."grand_total" - COALESCE("p"."total_paid", (0)::numeric)) - COALESCE("r"."total_returned", (0)::numeric)) > 0.01));


ALTER VIEW "public"."v_ar_aging_report" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_bsc_latest_kpi_measurements" AS
 SELECT "id",
    "cycle_id",
    "kpi_id",
    "measurement_date",
    "actual_value",
    "achievement_percent",
    "score_100",
    "score_4",
    "note",
    "measured_by",
    "created_at",
    "updated_at"
   FROM ( SELECT "m"."id",
            "m"."cycle_id",
            "m"."kpi_id",
            "m"."measurement_date",
            "m"."actual_value",
            "m"."achievement_percent",
            "m"."score_100",
            "m"."score_4",
            "m"."note",
            "m"."measured_by",
            "m"."created_at",
            "m"."updated_at",
            "row_number"() OVER (PARTITION BY "m"."kpi_id" ORDER BY "m"."measurement_date" DESC, "m"."created_at" DESC) AS "rn"
           FROM "public"."bsc_kpi_measurements" "m") "ranked"
  WHERE ("rn" = 1);


ALTER VIEW "public"."v_bsc_latest_kpi_measurements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_budget_vs_actual" AS
 WITH "actual_monthly" AS (
         SELECT "je"."org_id",
            "jl"."account_id",
            "date_trunc"('month'::"text", ("je"."entry_date")::timestamp with time zone) AS "period",
            "sum"(
                CASE
                    WHEN ("a_1"."normal_balance" = 'DEBIT'::"public"."normal_balance") THEN ("jl"."debit" - "jl"."credit")
                    ELSE ("jl"."credit" - "jl"."debit")
                END) AS "actual_amount"
           FROM (("public"."journal_lines" "jl"
             JOIN "public"."journal_entries" "je" ON (("je"."id" = "jl"."entry_id")))
             JOIN "public"."accounts" "a_1" ON (("a_1"."id" = "jl"."account_id")))
          WHERE ("je"."status" = 'POSTED'::"public"."journal_status")
          GROUP BY "je"."org_id", "jl"."account_id", ("date_trunc"('month'::"text", ("je"."entry_date")::timestamp with time zone))
        )
 SELECT "a"."org_id",
    "a"."id" AS "account_id",
    "a"."code" AS "account_code",
    "a"."name" AS "account_name",
    COALESCE(("b"."period")::timestamp with time zone, "am"."period") AS "period",
    COALESCE("b"."budget_amount", (0)::numeric) AS "budget_amount",
    COALESCE("am"."actual_amount", (0)::numeric) AS "actual_amount",
    (COALESCE("am"."actual_amount", (0)::numeric) - COALESCE("b"."budget_amount", (0)::numeric)) AS "variance"
   FROM (("public"."accounts" "a"
     LEFT JOIN "public"."budgets" "b" ON (("b"."account_id" = "a"."id")))
     LEFT JOIN "actual_monthly" "am" ON ((("am"."account_id" = "a"."id") AND ("am"."period" = "b"."period"))))
  WHERE ((("a"."type")::"text" = ANY (ARRAY['REVENUE'::"text", 'EXPENSE'::"text", 'COGS'::"text"])) AND (("b"."budget_amount" <> (0)::numeric) OR ("am"."actual_amount" <> (0)::numeric)));


ALTER VIEW "public"."v_budget_vs_actual" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_consolidated_journal_entries" AS
 SELECT "je"."id",
    "je"."org_id",
    "je"."entry_number",
    "je"."entry_date",
    "je"."description",
    "je"."reference_type",
    "je"."reference_id",
    "je"."status",
    "je"."is_auto",
    "je"."notes",
    "je"."created_by",
    "je"."posted_at",
    "je"."voided_at",
    "je"."voided_by",
    "je"."void_reason",
    "je"."created_at",
    "je"."updated_at",
    "je"."branch_id",
    "b"."name" AS "branch_name"
   FROM ("public"."journal_entries" "je"
     LEFT JOIN "public"."branches" "b" ON (("je"."branch_id" = "b"."id")))
  WHERE (("je"."status" = 'POSTED'::"public"."journal_status") AND (NOT ("je"."id" IN ( SELECT "intercompany_transactions"."journal_entry_id"
           FROM "public"."intercompany_transactions"
          WHERE (("intercompany_transactions"."is_eliminated" = true) AND ("intercompany_transactions"."journal_entry_id" IS NOT NULL))))));


ALTER VIEW "public"."v_consolidated_journal_entries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_employee_details" AS
 SELECT "e"."id",
    "e"."org_id",
    "e"."user_id",
    "e"."nik",
    "e"."first_name",
    "e"."last_name",
    "e"."email",
    "e"."phone",
    "e"."date_of_birth",
    "e"."gender",
    "e"."marital_status",
    "e"."tax_status",
    "e"."job_title",
    "e"."department",
    "e"."join_date",
    "e"."end_date",
    "e"."employment_status",
    "e"."bank_name",
    "e"."bank_account_number",
    "e"."bank_account_holder",
    "e"."basic_salary",
    "e"."created_at",
    "e"."updated_at",
    "o"."name" AS "organization_name",
    (( SELECT "count"(*) AS "count"
           FROM "public"."attendance" "a"
          WHERE (("a"."employee_id" = "e"."id") AND ("a"."record_date" = CURRENT_DATE))) > 0) AS "is_present_today",
    ( SELECT "sum"("ec"."amount") AS "sum"
           FROM ("public"."employee_components" "ec"
             JOIN "public"."payroll_components" "pc" ON (("ec"."component_id" = "pc"."id")))
          WHERE (("ec"."employee_id" = "e"."id") AND ("pc"."type" = 'EARNING'::"public"."payroll_item_type") AND ("ec"."is_active" = true))) AS "total_allowances"
   FROM ("public"."employees" "e"
     JOIN "public"."organizations" "o" ON (("e"."org_id" = "o"."id")));


ALTER VIEW "public"."v_employee_details" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_sales_growth_analysis" AS
 SELECT "je"."org_id",
    "date_trunc"('month'::"text", ("je"."entry_date")::timestamp with time zone) AS "report_month",
    "sum"(("jl"."credit" - "jl"."debit")) AS "mtd_sales"
   FROM (("public"."journal_lines" "jl"
     JOIN "public"."journal_entries" "je" ON (("je"."id" = "jl"."entry_id")))
     JOIN "public"."accounts" "a" ON (("a"."id" = "jl"."account_id")))
  WHERE (("je"."status" = 'POSTED'::"public"."journal_status") AND (("a"."code" ~~ '4%'::"text") OR ("a"."type" = 'REVENUE'::"public"."account_type")))
  GROUP BY "je"."org_id", ("date_trunc"('month'::"text", ("je"."entry_date")::timestamp with time zone));


ALTER VIEW "public"."v_sales_growth_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouse_bins" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "barcode" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."warehouse_bins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zakat_asset_timeline" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "total_assets" numeric(19,4) NOT NULL,
    "nishab_silver" numeric(19,4),
    "is_above_nishab" boolean,
    "haul_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."zakat_asset_timeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zakat_haul" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "haul_start_date" "date" NOT NULL,
    "gold_price_per_gram" numeric NOT NULL,
    "silver_price_per_gram" numeric NOT NULL,
    "nishab_gold" numeric NOT NULL,
    "nishab_silver" numeric NOT NULL,
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "batal_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gold_price_source" "text" DEFAULT 'Manual Input'::"text" NOT NULL,
    "gold_price_evidence_url" "text",
    "gold_price_set_by" "uuid",
    "gold_price_set_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "zakat_haul_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'BATAL'::"text", 'COMPLETED'::"text", 'ARCHIVED'::"text"])))
);


ALTER TABLE "public"."zakat_haul" OWNER TO "postgres";


COMMENT ON COLUMN "public"."zakat_haul"."gold_price_source" IS 'Sumber harga: Manual Input | Antam | Logam Mulia | Bank Indonesia | etc.';



COMMENT ON COLUMN "public"."zakat_haul"."gold_price_evidence_url" IS 'URL screenshot/bukti harga emas saat haul dimulai. Bukti audit.';



COMMENT ON COLUMN "public"."zakat_haul"."gold_price_set_by" IS 'User yang menginput harga emas — accountability trail.';



COMMENT ON COLUMN "public"."zakat_haul"."gold_price_set_at" IS 'Timestamp eksak harga emas diinput.';



CREATE TABLE IF NOT EXISTS "public"."zakat_haul_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "haul_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "total_assets" numeric NOT NULL,
    "is_above_nishab" boolean NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zakat_haul_events" OWNER TO "postgres";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_identifier_key" UNIQUE ("identifier");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_token_topup_orders"
    ADD CONSTRAINT "ai_token_topup_orders_invoice_id_key" UNIQUE ("invoice_id");



ALTER TABLE ONLY "public"."ai_token_topup_orders"
    ADD CONSTRAINT "ai_token_topup_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_token_topup_packages"
    ADD CONSTRAINT "ai_token_topup_packages_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."ai_token_topup_packages"
    ADD CONSTRAINT "ai_token_topup_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_token_usage_logs"
    ADD CONSTRAINT "ai_token_usage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_token_wallets"
    ADD CONSTRAINT "ai_token_wallets_pkey" PRIMARY KEY ("org_id");



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_depreciation_logs"
    ADD CONSTRAINT "asset_depreciation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_employee_id_record_date_key" UNIQUE ("employee_id", "record_date");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_org_id_account_number_key" UNIQUE ("org_id", "account_number");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_mutations"
    ADD CONSTRAINT "bank_mutations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bsc_cycles"
    ADD CONSTRAINT "bsc_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bsc_kpi_measurements"
    ADD CONSTRAINT "bsc_kpi_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bsc_kpi_measurements"
    ADD CONSTRAINT "bsc_kpi_measurements_unique" UNIQUE ("cycle_id", "kpi_id", "measurement_date");



ALTER TABLE ONLY "public"."bsc_kpis"
    ADD CONSTRAINT "bsc_kpis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bsc_kpis"
    ADD CONSTRAINT "bsc_kpis_unique_code" UNIQUE ("cycle_id", "code");



ALTER TABLE ONLY "public"."bsc_perspective_weights"
    ADD CONSTRAINT "bsc_perspective_weights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bsc_perspective_weights"
    ADD CONSTRAINT "bsc_perspective_weights_unique" UNIQUE ("cycle_id", "perspective");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_org_id_account_id_period_key" UNIQUE ("org_id", "account_id", "period");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coa_account_requests"
    ADD CONSTRAINT "coa_account_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_components"
    ADD CONSTRAINT "employee_components_employee_id_component_id_key" UNIQUE ("employee_id", "component_id");



ALTER TABLE ONLY "public"."employee_components"
    ADD CONSTRAINT "employee_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_org_id_nik_key" UNIQUE ("org_id", "nik");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fiscal_periods"
    ADD CONSTRAINT "fiscal_periods_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."fiscal_periods"
    ADD CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_assets"
    ADD CONSTRAINT "fleet_assets_org_id_plate_number_key" UNIQUE ("org_id", "plate_number");



ALTER TABLE ONLY "public"."fleet_assets"
    ADD CONSTRAINT "fleet_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_bookings"
    ADD CONSTRAINT "fleet_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_maintenance_labs"
    ADD CONSTRAINT "fleet_maintenance_labs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_routes"
    ADD CONSTRAINT "fleet_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_schedules"
    ADD CONSTRAINT "fleet_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_terminals"
    ADD CONSTRAINT "fleet_terminals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_terminals"
    ADD CONSTRAINT "fleet_terminals_qr_code_token_key" UNIQUE ("qr_code_token");



ALTER TABLE ONLY "public"."fleet_tickets"
    ADD CONSTRAINT "fleet_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intercompany_accounts"
    ADD CONSTRAINT "intercompany_accounts_org_id_branch_id_key" UNIQUE ("org_id", "branch_id");



ALTER TABLE ONLY "public"."intercompany_accounts"
    ADD CONSTRAINT "intercompany_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intercompany_transactions"
    ADD CONSTRAINT "intercompany_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_adjustment_items"
    ADD CONSTRAINT "inventory_adjustment_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_org_id_adj_number_key" UNIQUE ("org_id", "adj_number");



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_stocks"
    ADD CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transfer_items"
    ADD CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_org_id_transfer_number_key" UNIQUE ("org_id", "transfer_number");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_org_id_entry_number_key" UNIQUE ("org_id", "entry_number");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_invitation_code_key" UNIQUE ("invitation_code");



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_member_units"
    ADD CONSTRAINT "org_member_units_org_member_id_branch_id_key" UNIQUE ("org_member_id", "branch_id");



ALTER TABLE ONLY "public"."org_member_units"
    ADD CONSTRAINT "org_member_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_org_id_user_id_key" UNIQUE ("org_id", "user_id");



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."payroll_components"
    ADD CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payslip_lines"
    ADD CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_bom_items"
    ADD CONSTRAINT "production_bom_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_boms"
    ADD CONSTRAINT "production_boms_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."production_boms"
    ADD CONSTRAINT "production_boms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_wo_costs"
    ADD CONSTRAINT "production_wo_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_work_orders"
    ADD CONSTRAINT "production_work_orders_org_id_wo_number_key" UNIQUE ("org_id", "wo_number");



ALTER TABLE ONLY "public"."production_work_orders"
    ADD CONSTRAINT "production_work_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_org_id_sku_key" UNIQUE ("org_id", "sku");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_org_id_payment_number_key" UNIQUE ("org_id", "payment_number");



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_requests"
    ADD CONSTRAINT "purchase_requests_org_id_request_number_key" UNIQUE ("org_id", "request_number");



ALTER TABLE ONLY "public"."purchase_requests"
    ADD CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_return_items"
    ADD CONSTRAINT "purchase_return_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_returns"
    ADD CONSTRAINT "purchase_returns_org_id_return_number_key" UNIQUE ("org_id", "return_number");



ALTER TABLE ONLY "public"."purchase_returns"
    ADD CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_org_id_purchase_number_key" UNIQUE ("org_id", "purchase_number");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reimbursement_items"
    ADD CONSTRAINT "reimbursement_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reimbursements"
    ADD CONSTRAINT "reimbursements_org_id_claim_number_key" UNIQUE ("org_id", "claim_number");



ALTER TABLE ONLY "public"."reimbursements"
    ADD CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saas_config"
    ADD CONSTRAINT "saas_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."saas_invoices"
    ADD CONSTRAINT "saas_invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."saas_invoices"
    ADD CONSTRAINT "saas_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saas_packages"
    ADD CONSTRAINT "saas_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saas_vouchers"
    ADD CONSTRAINT "saas_vouchers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."saas_vouchers"
    ADD CONSTRAINT "saas_vouchers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_items"
    ADD CONSTRAINT "sales_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_org_id_sale_number_key" UNIQUE ("org_id", "sale_number");



ALTER TABLE ONLY "public"."sales_page_leads"
    ADD CONSTRAINT "sales_page_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_pages"
    ADD CONSTRAINT "sales_pages_org_id_slug_key" UNIQUE ("org_id", "slug");



ALTER TABLE ONLY "public"."sales_pages"
    ADD CONSTRAINT "sales_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_payments"
    ADD CONSTRAINT "sales_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_return_items"
    ADD CONSTRAINT "sales_return_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_returns"
    ADD CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_returns"
    ADD CONSTRAINT "sales_returns_return_number_key" UNIQUE ("return_number");



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_ticket_updates"
    ADD CONSTRAINT "support_ticket_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_ticket_no_key" UNIQUE ("ticket_no");



ALTER TABLE ONLY "public"."warehouse_bins"
    ADD CONSTRAINT "warehouse_bins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouse_bins"
    ADD CONSTRAINT "warehouse_bins_warehouse_id_code_key" UNIQUE ("warehouse_id", "code");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zakat_asset_timeline"
    ADD CONSTRAINT "zakat_asset_timeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zakat_haul_events"
    ADD CONSTRAINT "zakat_haul_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zakat_haul"
    ADD CONSTRAINT "zakat_haul_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "custom_oauth_providers_created_at_idx" ON "auth"."custom_oauth_providers" USING "btree" ("created_at");



CREATE INDEX "custom_oauth_providers_enabled_idx" ON "auth"."custom_oauth_providers" USING "btree" ("enabled");



CREATE INDEX "custom_oauth_providers_identifier_idx" ON "auth"."custom_oauth_providers" USING "btree" ("identifier");



CREATE INDEX "custom_oauth_providers_provider_type_idx" ON "auth"."custom_oauth_providers" USING "btree" ("provider_type");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "webauthn_challenges_expires_at_idx" ON "auth"."webauthn_challenges" USING "btree" ("expires_at");



CREATE INDEX "webauthn_challenges_user_id_idx" ON "auth"."webauthn_challenges" USING "btree" ("user_id");



CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "auth"."webauthn_credentials" USING "btree" ("credential_id");



CREATE INDEX "webauthn_credentials_user_id_idx" ON "auth"."webauthn_credentials" USING "btree" ("user_id");



CREATE INDEX "idx_accounts_org_id" ON "public"."accounts" USING "btree" ("org_id");



CREATE INDEX "idx_accounts_org_managed_branch" ON "public"."accounts" USING "btree" ("org_id", "managed_branch_id");



CREATE INDEX "idx_accounts_parent_id" ON "public"."accounts" USING "btree" ("parent_id");



CREATE INDEX "idx_accounts_type" ON "public"."accounts" USING "btree" ("type");



CREATE INDEX "idx_ai_token_topup_orders_org_status" ON "public"."ai_token_topup_orders" USING "btree" ("org_id", "status", "created_at" DESC);



CREATE INDEX "idx_ai_token_topup_packages_active_sort" ON "public"."ai_token_topup_packages" USING "btree" ("is_active", "sort_order", "price_idr");



CREATE INDEX "idx_ai_token_usage_logs_org_created" ON "public"."ai_token_usage_logs" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_ai_token_usage_logs_source" ON "public"."ai_token_usage_logs" USING "btree" ("source");



CREATE INDEX "idx_ai_token_wallets_balance" ON "public"."ai_token_wallets" USING "btree" ("balance_tokens");



CREATE INDEX "idx_approval_requests_org_branch_status" ON "public"."approval_requests" USING "btree" ("org_id", "branch_id", "status", "requested_at" DESC);



CREATE INDEX "idx_asset_depreciation_logs_org_branch_period" ON "public"."asset_depreciation_logs" USING "btree" ("org_id", "branch_id", "period_date" DESC);



CREATE INDEX "idx_attendance_org_branch_date" ON "public"."attendance" USING "btree" ("org_id", "branch_id", "record_date");



CREATE INDEX "idx_attendance_org_date" ON "public"."attendance" USING "btree" ("org_id", "record_date");



CREATE INDEX "idx_bank_accounts_account_id" ON "public"."bank_accounts" USING "btree" ("account_id");



CREATE INDEX "idx_bank_accounts_org_branch_active" ON "public"."bank_accounts" USING "btree" ("org_id", "branch_id", "is_active");



CREATE INDEX "idx_bank_accounts_org_id" ON "public"."bank_accounts" USING "btree" ("org_id");



CREATE INDEX "idx_bank_mutations_account" ON "public"."bank_mutations" USING "btree" ("bank_account_id");



CREATE INDEX "idx_bank_mutations_matched" ON "public"."bank_mutations" USING "btree" ("is_matched");



CREATE INDEX "idx_bank_mutations_org_branch_date" ON "public"."bank_mutations" USING "btree" ("org_id", "branch_id", "mutation_date" DESC);



CREATE INDEX "idx_bank_mutations_org_id" ON "public"."bank_mutations" USING "btree" ("org_id");



CREATE INDEX "idx_bank_transactions_bank_account" ON "public"."bank_transactions" USING "btree" ("bank_account_id");



CREATE INDEX "idx_bank_transactions_date" ON "public"."bank_transactions" USING "btree" ("transaction_date");



CREATE INDEX "idx_bank_transactions_org_branch_date" ON "public"."bank_transactions" USING "btree" ("org_id", "branch_id", "transaction_date" DESC);



CREATE INDEX "idx_bank_transactions_org_id" ON "public"."bank_transactions" USING "btree" ("org_id");



CREATE INDEX "idx_bins_barcode_fast" ON "public"."warehouse_bins" USING "btree" ("barcode") WHERE (("barcode" IS NOT NULL) AND ("barcode" <> ''::"text"));



CREATE UNIQUE INDEX "idx_bins_barcode_unique" ON "public"."warehouse_bins" USING "btree" ("barcode") WHERE (("barcode" IS NOT NULL) AND ("barcode" <> ''::"text"));



CREATE UNIQUE INDEX "idx_bins_barcode_unique_per_org" ON "public"."warehouse_bins" USING "btree" ("org_id", "barcode") WHERE (("barcode" IS NOT NULL) AND ("barcode" <> ''::"text"));



CREATE INDEX "idx_boms_product" ON "public"."production_boms" USING "btree" ("product_id");



CREATE INDEX "idx_bsc_cycles_branch" ON "public"."bsc_cycles" USING "btree" ("branch_id", "start_date" DESC);



CREATE INDEX "idx_bsc_cycles_org_status" ON "public"."bsc_cycles" USING "btree" ("org_id", "status", "start_date" DESC);



CREATE INDEX "idx_bsc_kpi_measurements_cycle_date" ON "public"."bsc_kpi_measurements" USING "btree" ("cycle_id", "measurement_date" DESC);



CREATE INDEX "idx_bsc_kpi_measurements_kpi_date" ON "public"."bsc_kpi_measurements" USING "btree" ("kpi_id", "measurement_date" DESC);



CREATE INDEX "idx_bsc_kpis_active" ON "public"."bsc_kpis" USING "btree" ("cycle_id", "is_active");



CREATE INDEX "idx_bsc_kpis_cycle" ON "public"."bsc_kpis" USING "btree" ("cycle_id", "perspective");



CREATE INDEX "idx_bsc_perspective_weights_cycle" ON "public"."bsc_perspective_weights" USING "btree" ("cycle_id");



CREATE INDEX "idx_budgets_org_branch_period" ON "public"."budgets" USING "btree" ("org_id", "branch_id", "period" DESC);



CREATE INDEX "idx_budgets_org_period" ON "public"."budgets" USING "btree" ("org_id", "period");



CREATE INDEX "idx_coa_requests_org_id" ON "public"."coa_account_requests" USING "btree" ("org_id");



CREATE INDEX "idx_coa_requests_requested_by" ON "public"."coa_account_requests" USING "btree" ("requested_by");



CREATE INDEX "idx_coa_requests_requester_org" ON "public"."coa_account_requests" USING "btree" ("requester_org_id");



CREATE INDEX "idx_coa_requests_status" ON "public"."coa_account_requests" USING "btree" ("status", "org_id");



CREATE INDEX "idx_contacts_ig" ON "public"."contacts" USING "btree" ("instagram");



CREATE INDEX "idx_contacts_org_id" ON "public"."contacts" USING "btree" ("org_id");



CREATE INDEX "idx_contacts_type" ON "public"."contacts" USING "btree" ("type");



CREATE INDEX "idx_contacts_wa" ON "public"."contacts" USING "btree" ("phone_wa");



CREATE INDEX "idx_employees_nik_org" ON "public"."employees" USING "btree" ("org_id", "nik");



CREATE INDEX "idx_employees_org" ON "public"."employees" USING "btree" ("org_id");



CREATE INDEX "idx_employees_org_branch" ON "public"."employees" USING "btree" ("org_id", "branch_id");



CREATE INDEX "idx_employees_status" ON "public"."employees" USING "btree" ("employment_status");



CREATE INDEX "idx_employees_user_id" ON "public"."employees" USING "btree" ("user_id");



CREATE INDEX "idx_expense_claims_org_branch_date" ON "public"."expense_claims" USING "btree" ("org_id", "branch_id", "claim_date" DESC);



CREATE INDEX "idx_fixed_assets_org_branch_status" ON "public"."fixed_assets" USING "btree" ("org_id", "branch_id", "status", "purchase_date" DESC);



CREATE INDEX "idx_fleet_assets_org_branch" ON "public"."fleet_assets" USING "btree" ("org_id", "branch_id");



CREATE INDEX "idx_fleet_bookings_org_branch" ON "public"."fleet_bookings" USING "btree" ("org_id", "branch_id");



CREATE INDEX "idx_fleet_maintenance_org_branch_date" ON "public"."fleet_maintenance_labs" USING "btree" ("org_id", "branch_id", "service_date");



CREATE INDEX "idx_fleet_routes_org_branch" ON "public"."fleet_routes" USING "btree" ("org_id", "branch_id");



CREATE INDEX "idx_fleet_schedules_org_branch_departure" ON "public"."fleet_schedules" USING "btree" ("org_id", "branch_id", "departure_time");



CREATE INDEX "idx_fleet_terminals_org_branch" ON "public"."fleet_terminals" USING "btree" ("org_id", "branch_id");



CREATE INDEX "idx_fleet_tickets_org_branch" ON "public"."fleet_tickets" USING "btree" ("org_id", "branch_id");



CREATE INDEX "idx_intercompany_eliminated" ON "public"."intercompany_transactions" USING "btree" ("is_eliminated");



CREATE INDEX "idx_intercompany_org" ON "public"."intercompany_transactions" USING "btree" ("org_id");



CREATE UNIQUE INDEX "idx_inv_stocks_unique_wms" ON "public"."inventory_stocks" USING "btree" ("product_id", "warehouse_id", COALESCE("batch_number", ''::"text"), COALESCE("bin_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "idx_inv_transfer_items_org_id" ON "public"."inventory_transfer_items" USING "btree" ("org_id");



CREATE INDEX "idx_inv_transfer_items_product_id" ON "public"."inventory_transfer_items" USING "btree" ("product_id");



CREATE INDEX "idx_inv_transfer_items_transfer_id" ON "public"."inventory_transfer_items" USING "btree" ("transfer_id");



CREATE INDEX "idx_inv_transfer_org_id" ON "public"."inventory_transfers" USING "btree" ("org_id");



CREATE INDEX "idx_inv_transfer_source_wh" ON "public"."inventory_transfers" USING "btree" ("source_wh_id");



CREATE INDEX "idx_inv_transfer_target_wh" ON "public"."inventory_transfers" USING "btree" ("target_wh_id");



CREATE INDEX "idx_invitations_code" ON "public"."org_invitations" USING "btree" ("invitation_code");



CREATE INDEX "idx_journal_branch" ON "public"."journal_entries" USING "btree" ("branch_id") WHERE ("branch_id" IS NOT NULL);



CREATE INDEX "idx_journal_entries_entry_date" ON "public"."journal_entries" USING "btree" ("entry_date");



CREATE INDEX "idx_journal_entries_org_branch_date" ON "public"."journal_entries" USING "btree" ("org_id", "branch_id", "entry_date" DESC);



CREATE INDEX "idx_journal_entries_org_id" ON "public"."journal_entries" USING "btree" ("org_id");



CREATE INDEX "idx_journal_entries_reference" ON "public"."journal_entries" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_journal_entries_status" ON "public"."journal_entries" USING "btree" ("status");



CREATE INDEX "idx_journal_lines_account_id" ON "public"."journal_lines" USING "btree" ("account_id");



CREATE INDEX "idx_journal_lines_entry_account" ON "public"."journal_lines" USING "btree" ("entry_id", "account_id");



CREATE INDEX "idx_journal_lines_entry_id" ON "public"."journal_lines" USING "btree" ("entry_id");



CREATE INDEX "idx_leave_requests_org_branch_period" ON "public"."leave_requests" USING "btree" ("org_id", "branch_id", "start_date" DESC, "status");



CREATE INDEX "idx_org_member_units_member" ON "public"."org_member_units" USING "btree" ("org_member_id");



CREATE INDEX "idx_org_member_units_org_branch" ON "public"."org_member_units" USING "btree" ("org_id", "branch_id");



CREATE INDEX "idx_org_members_org_id" ON "public"."org_members" USING "btree" ("org_id");



CREATE INDEX "idx_org_members_user_id" ON "public"."org_members" USING "btree" ("user_id");



CREATE INDEX "idx_org_members_user_last_active" ON "public"."org_members" USING "btree" ("user_id", "last_active_at" DESC);



CREATE INDEX "idx_org_parent" ON "public"."organizations" USING "btree" ("parent_org_id");



CREATE INDEX "idx_organizations_manager" ON "public"."organizations" USING "btree" ("manager_employee_id");



CREATE UNIQUE INDEX "idx_organizations_name_unique_ci" ON "public"."organizations" USING "btree" ("lower"(TRIM(BOTH FROM "name")));



CREATE INDEX "idx_organizations_slug" ON "public"."organizations" USING "btree" ("slug");



CREATE INDEX "idx_payroll_runs_org_branch_period" ON "public"."payroll_runs" USING "btree" ("org_id", "branch_id", "period_start" DESC);



CREATE INDEX "idx_payslip_lines_component" ON "public"."payslip_lines" USING "btree" ("component_id");



CREATE INDEX "idx_payslip_lines_payslip" ON "public"."payslip_lines" USING "btree" ("payslip_id");



CREATE INDEX "idx_payslips_run_branch" ON "public"."payslips" USING "btree" ("run_id", "branch_id", "employee_id");



CREATE INDEX "idx_production_boms_org_branch_active" ON "public"."production_boms" USING "btree" ("org_id", "branch_id", "is_active");



CREATE INDEX "idx_production_work_orders_bom_branch" ON "public"."production_work_orders" USING "btree" ("bom_id", "branch_id");



CREATE INDEX "idx_production_work_orders_org_branch_status" ON "public"."production_work_orders" USING "btree" ("org_id", "branch_id", "status", "created_at" DESC);



CREATE INDEX "idx_products_barcode_fast" ON "public"."products" USING "btree" ("barcode") WHERE (("barcode" IS NOT NULL) AND ("barcode" <> ''::"text"));



CREATE UNIQUE INDEX "idx_products_barcode_unique" ON "public"."products" USING "btree" ("barcode") WHERE (("barcode" IS NOT NULL) AND ("barcode" <> ''::"text"));



CREATE UNIQUE INDEX "idx_products_barcode_unique_per_org" ON "public"."products" USING "btree" ("org_id", "barcode") WHERE (("barcode" IS NOT NULL) AND ("barcode" <> ''::"text"));



COMMENT ON INDEX "public"."idx_products_barcode_unique_per_org" IS 'Ensures barcode is unique only within an organization, ignoring empty/null values.';



CREATE INDEX "idx_products_org_id" ON "public"."products" USING "btree" ("org_id");



CREATE INDEX "idx_purchase_requests_org_branch_status" ON "public"."purchase_requests" USING "btree" ("org_id", "branch_id", "status", "created_at" DESC);



CREATE INDEX "idx_purchases_org_branch_date" ON "public"."purchases" USING "btree" ("org_id", "branch_id", "purchase_date" DESC);



CREATE INDEX "idx_purchases_org_id" ON "public"."purchases" USING "btree" ("org_id");



CREATE INDEX "idx_purchases_vendor_id" ON "public"."purchases" USING "btree" ("vendor_id");



CREATE INDEX "idx_reimbursements_org_branch_status_date" ON "public"."reimbursements" USING "btree" ("org_id", "branch_id", "status", "created_at" DESC);



CREATE INDEX "idx_roles_org_id" ON "public"."roles" USING "btree" ("org_id");



CREATE INDEX "idx_roles_source_org_id" ON "public"."roles" USING "btree" ("source_org_id");



CREATE INDEX "idx_roles_source_role_id" ON "public"."roles" USING "btree" ("source_role_id");



CREATE INDEX "idx_saas_invoices_org" ON "public"."saas_invoices" USING "btree" ("org_id");



CREATE INDEX "idx_saas_invoices_status" ON "public"."saas_invoices" USING "btree" ("status");



CREATE INDEX "idx_sales_customer_id" ON "public"."sales" USING "btree" ("customer_id");



CREATE INDEX "idx_sales_items_branch_id" ON "public"."sales_items" USING "btree" ("branch_id") WHERE ("branch_id" IS NOT NULL);



CREATE INDEX "idx_sales_org_branch_date" ON "public"."sales" USING "btree" ("org_id", "branch_id", "sale_date" DESC);



CREATE INDEX "idx_sales_org_branch_warehouse_date" ON "public"."sales" USING "btree" ("org_id", "branch_id", "warehouse_id", "sale_date" DESC);



CREATE INDEX "idx_sales_org_id" ON "public"."sales" USING "btree" ("org_id");



CREATE INDEX "idx_sales_page_leads_org_id" ON "public"."sales_page_leads" USING "btree" ("org_id");



CREATE INDEX "idx_sales_page_leads_page_id" ON "public"."sales_page_leads" USING "btree" ("sales_page_id");



CREATE INDEX "idx_sales_page_leads_status" ON "public"."sales_page_leads" USING "btree" ("status");



CREATE INDEX "idx_sales_pages_org_id" ON "public"."sales_pages" USING "btree" ("org_id");



CREATE INDEX "idx_sales_pages_slug" ON "public"."sales_pages" USING "btree" ("slug");



CREATE INDEX "idx_sales_pages_status" ON "public"."sales_pages" USING "btree" ("status");



CREATE INDEX "idx_sales_pages_template_id" ON "public"."sales_pages" USING "btree" ("template_id");



CREATE INDEX "idx_sales_payments_org" ON "public"."sales_payments" USING "btree" ("org_id");



CREATE INDEX "idx_sales_payments_org_branch_date" ON "public"."sales_payments" USING "btree" ("org_id", "branch_id", "payment_date" DESC);



CREATE INDEX "idx_sales_payments_sale" ON "public"."sales_payments" USING "btree" ("sale_id");



CREATE INDEX "idx_sales_returns_org_branch_date" ON "public"."sales_returns" USING "btree" ("org_id", "branch_id", "return_date" DESC);



CREATE INDEX "idx_service_orders_org" ON "public"."service_orders" USING "btree" ("org_id");



CREATE INDEX "idx_service_orders_org_branch" ON "public"."service_orders" USING "btree" ("org_id", "branch_id");



CREATE INDEX "idx_service_orders_status" ON "public"."service_orders" USING "btree" ("status");



CREATE INDEX "idx_stock_movements_org_branch_product_date" ON "public"."stock_movements" USING "btree" ("org_id", "branch_id", "product_id", "movement_date" DESC);



CREATE INDEX "idx_support_ticket_updates_org_public_created_at" ON "public"."support_ticket_updates" USING "btree" ("org_id", "is_public", "created_at" DESC);



CREATE INDEX "idx_support_ticket_updates_ticket_created_at" ON "public"."support_ticket_updates" USING "btree" ("ticket_id", "created_at" DESC);



CREATE INDEX "idx_support_tickets_org_created_at" ON "public"."support_tickets" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_support_tickets_org_status" ON "public"."support_tickets" USING "btree" ("org_id", "status");



CREATE INDEX "idx_support_tickets_reporter" ON "public"."support_tickets" USING "btree" ("reporter_user_id", "created_at" DESC);



CREATE INDEX "idx_warehouses_org_branch_active" ON "public"."warehouses" USING "btree" ("org_id", "branch_id", "is_active");



CREATE INDEX "idx_wo_deadline" ON "public"."production_work_orders" USING "btree" ("org_id", "deadline_date", "status");



CREATE INDEX "idx_wo_status" ON "public"."production_work_orders" USING "btree" ("org_id", "status");



CREATE UNIQUE INDEX "idx_zakat_haul_org_active" ON "public"."zakat_haul" USING "btree" ("org_id") WHERE ("status" = 'ACTIVE'::"text");



CREATE INDEX "idx_zakat_timeline_org" ON "public"."zakat_asset_timeline" USING "btree" ("org_id", "created_at");



CREATE UNIQUE INDEX "saas_packages_name_idx" ON "public"."saas_packages" USING "btree" ("name");



CREATE UNIQUE INDEX "uq_bsc_cycles_scope_cycle" ON "public"."bsc_cycles" USING "btree" ("org_id", "branch_scope_key", "cycle_key");



CREATE UNIQUE INDEX "uq_budget_account_period_per_branch" ON "public"."budgets" USING "btree" ("org_id", "branch_id", "account_id", "period") WHERE ("branch_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_budget_account_period_shared" ON "public"."budgets" USING "btree" ("org_id", "account_id", "period") WHERE ("branch_id" IS NULL);



CREATE UNIQUE INDEX "uq_roles_org_source_role" ON "public"."roles" USING "btree" ("org_id", "source_role_id") WHERE ("source_role_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_support_tickets_ticket_no" ON "public"."support_tickets" USING "btree" ("ticket_no");



CREATE OR REPLACE TRIGGER "audit_contacts_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "audit_journal_entries_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "audit_org_members_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."org_members" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "audit_products_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "audit_purchases_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "audit_sales_page_leads_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."sales_page_leads" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "audit_sales_pages_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."sales_pages" FOR EACH ROW EXECUTE FUNCTION "public"."log_audit_event"();



CREATE OR REPLACE TRIGGER "set_updated_at_purchase_items" BEFORE UPDATE ON "public"."purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_sales_items" BEFORE UPDATE ON "public"."sales_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_000_bootstrap_main_branch_on_org_create" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."bootstrap_main_branch_on_org_create"();



CREATE OR REPLACE TRIGGER "trg_accounts_delete_governance" BEFORE DELETE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_accounts_delete_governance"();



CREATE OR REPLACE TRIGGER "trg_accounts_governance" BEFORE INSERT OR UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_accounts_governance"();



CREATE OR REPLACE TRIGGER "trg_accounts_updated_at" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_ai_token_topup_orders_updated_at" BEFORE UPDATE ON "public"."ai_token_topup_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_ai_token_topup_packages_updated_at" BEFORE UPDATE ON "public"."ai_token_topup_packages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_ai_token_wallets_updated_at" BEFORE UPDATE ON "public"."ai_token_wallets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_approval_requests_default_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."approval_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_branch_context"();



CREATE OR REPLACE TRIGGER "trg_asset_depreciation_log_branch_context" BEFORE INSERT OR UPDATE ON "public"."asset_depreciation_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_asset_depreciation_log_branch_context"();



CREATE OR REPLACE TRIGGER "trg_attendance_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "employee_id" ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."set_attendance_branch_context"();



CREATE OR REPLACE TRIGGER "trg_attendance_updated_at" BEFORE UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_bank_accounts_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_bank_account_branch_context"();



CREATE OR REPLACE TRIGGER "trg_bank_accounts_updated_at" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_bank_mutations_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id", "bank_account_id" ON "public"."bank_mutations" FOR EACH ROW EXECUTE FUNCTION "public"."set_bank_mutation_branch_context"();



CREATE OR REPLACE TRIGGER "trg_bank_transaction_auto_journal" BEFORE INSERT ON "public"."bank_transactions" FOR EACH ROW WHEN (("new"."status" = 'POSTED'::"text")) EXECUTE FUNCTION "public"."auto_journal_bank_transaction"();



CREATE OR REPLACE TRIGGER "trg_bank_transactions_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id", "bank_account_id" ON "public"."bank_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_bank_transaction_branch_context"();



CREATE OR REPLACE TRIGGER "trg_bank_transactions_updated_at" BEFORE UPDATE ON "public"."bank_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_bootstrap_org_member_units" AFTER INSERT OR UPDATE OF "role", "is_active" ON "public"."org_members" FOR EACH ROW EXECUTE FUNCTION "public"."bootstrap_org_member_units"();



CREATE OR REPLACE TRIGGER "trg_bootstrap_single_branch_member_units" AFTER INSERT OR UPDATE OF "is_active" ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."bootstrap_single_branch_member_units"();



CREATE OR REPLACE TRIGGER "trg_bsc_cycles_updated_at" BEFORE UPDATE ON "public"."bsc_cycles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_bsc_kpi_measurements_updated_at" BEFORE UPDATE ON "public"."bsc_kpi_measurements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_bsc_kpis_updated_at" BEFORE UPDATE ON "public"."bsc_kpis" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_bsc_perspective_weights_updated_at" BEFORE UPDATE ON "public"."bsc_perspective_weights" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_budget_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."budgets" FOR EACH ROW EXECUTE FUNCTION "public"."set_budget_branch_context"();



CREATE OR REPLACE TRIGGER "trg_check_journal_closed_period" BEFORE INSERT OR DELETE OR UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."check_closed_period"();



CREATE OR REPLACE TRIGGER "trg_coa_request_governance" BEFORE INSERT ON "public"."coa_account_requests" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_coa_request_governance"();



CREATE OR REPLACE TRIGGER "trg_coa_request_updated_at" BEFORE UPDATE ON "public"."coa_account_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_coa_request_updated_at"();



CREATE OR REPLACE TRIGGER "trg_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_expense_claim_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "employee_id" ON "public"."expense_claims" FOR EACH ROW EXECUTE FUNCTION "public"."set_expense_claim_branch_context"();



CREATE OR REPLACE TRIGGER "trg_expense_claims_updated_at" BEFORE UPDATE ON "public"."expense_claims" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_fill_bsc_measurement_scores" BEFORE INSERT OR UPDATE OF "actual_value", "kpi_id", "cycle_id" ON "public"."bsc_kpi_measurements" FOR EACH ROW EXECUTE FUNCTION "public"."fill_bsc_measurement_scores"();



CREATE OR REPLACE TRIGGER "trg_fleet_bookings_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "asset_id" ON "public"."fleet_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_fleet_branch_context"();



CREATE OR REPLACE TRIGGER "trg_fleet_maintenance_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "asset_id" ON "public"."fleet_maintenance_labs" FOR EACH ROW EXECUTE FUNCTION "public"."set_fleet_branch_context"();



CREATE OR REPLACE TRIGGER "trg_fleet_schedules_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "route_id", "asset_id" ON "public"."fleet_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_fleet_branch_context"();



CREATE OR REPLACE TRIGGER "trg_fleet_tickets_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "schedule_id" ON "public"."fleet_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."set_fleet_branch_context"();



CREATE OR REPLACE TRIGGER "trg_generate_inventory_adj_number" BEFORE INSERT ON "public"."inventory_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."generate_inventory_adj_number"();



CREATE OR REPLACE TRIGGER "trg_guard_sales_non_salam_stock_after_delivery" BEFORE UPDATE OF "status", "warehouse_id" ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."guard_sales_non_salam_stock_after_delivery"();



CREATE OR REPLACE TRIGGER "trg_journal_entries_updated_at" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_journal_entry_default_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_journal_entry_default_branch_context"();



CREATE OR REPLACE TRIGGER "trg_leave_request_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "employee_id" ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_leave_request_branch_context"();



CREATE OR REPLACE TRIGGER "trg_leave_requests_updated_at" BEFORE UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_payroll_components_updated_at" BEFORE UPDATE ON "public"."payroll_components" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_payroll_runs_updated_at" BEFORE UPDATE ON "public"."payroll_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_prevent_overlapping_fleet_bookings" BEFORE INSERT OR UPDATE OF "org_id", "asset_id", "start_date", "end_date", "status" ON "public"."fleet_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_overlapping_fleet_bookings"();



CREATE OR REPLACE TRIGGER "trg_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_purchase_requests_default_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."purchase_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_branch_context"();



CREATE OR REPLACE TRIGGER "trg_purchase_requests_updated_at" BEFORE UPDATE ON "public"."purchase_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_purchases_default_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_branch_context"();



CREATE OR REPLACE TRIGGER "trg_recalculate_average_cost" AFTER INSERT ON "public"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_average_cost"();



CREATE OR REPLACE TRIGGER "trg_sales_default_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_branch_context"();



CREATE OR REPLACE TRIGGER "trg_sales_items_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "sale_id", "branch_id" ON "public"."sales_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_sales_item_branch_context"();



CREATE OR REPLACE TRIGGER "trg_sales_pages_updated_at" BEFORE UPDATE ON "public"."sales_pages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_sales_payments_default_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."sales_payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_branch_context"();



CREATE OR REPLACE TRIGGER "trg_sales_returns_default_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."sales_returns" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_branch_context"();



CREATE OR REPLACE TRIGGER "trg_sales_warehouse_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id", "warehouse_id" ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."set_sale_warehouse_context"();



CREATE OR REPLACE TRIGGER "trg_set_entry_number" BEFORE INSERT ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_entry_number"();



CREATE OR REPLACE TRIGGER "trg_set_purchase_number" BEFORE INSERT ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."set_purchase_number"();



CREATE OR REPLACE TRIGGER "trg_set_request_number" BEFORE INSERT ON "public"."purchase_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_request_number"();



CREATE OR REPLACE TRIGGER "trg_set_sale_number" BEFORE INSERT ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."set_sale_number"();



CREATE OR REPLACE TRIGGER "trg_set_transfer_number" BEFORE INSERT ON "public"."inventory_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."set_transfer_number"();



CREATE OR REPLACE TRIGGER "trg_stock_movements_branch_id" BEFORE INSERT OR UPDATE ON "public"."stock_movements" FOR EACH ROW EXECUTE FUNCTION "public"."set_stock_movement_branch_id"();



CREATE OR REPLACE TRIGGER "trg_support_tickets_updated_at" BEFORE UPDATE ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_sync_bsc_cycle_scope_key" BEFORE INSERT OR UPDATE ON "public"."bsc_cycles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_bsc_cycle_scope_key"();



CREATE OR REPLACE TRIGGER "trg_sync_parent_roles_after_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_sync_parent_roles_after_change"();



CREATE OR REPLACE TRIGGER "trg_validate_journal_balance" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."validate_journal_balance_on_post"();



CREATE OR REPLACE TRIGGER "trg_warehouses_default_branch_context" BEFORE INSERT OR UPDATE OF "org_id", "branch_id" ON "public"."warehouses" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_branch_context"();



CREATE OR REPLACE TRIGGER "trg_zz_seed_inventory_accounts_on_org_create" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_seed_inventory_segment_accounts"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_managed_branch_id_fkey" FOREIGN KEY ("managed_branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_token_topup_orders"
    ADD CONSTRAINT "ai_token_topup_orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."saas_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_token_topup_orders"
    ADD CONSTRAINT "ai_token_topup_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_token_topup_orders"
    ADD CONSTRAINT "ai_token_topup_orders_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."ai_token_topup_packages"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ai_token_usage_logs"
    ADD CONSTRAINT "ai_token_usage_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_token_usage_logs"
    ADD CONSTRAINT "ai_token_usage_logs_related_invoice_id_fkey" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."saas_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_token_usage_logs"
    ADD CONSTRAINT "ai_token_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_token_wallets"
    ADD CONSTRAINT "ai_token_wallets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."asset_depreciation_logs"
    ADD CONSTRAINT "asset_depreciation_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_depreciation_logs"
    ADD CONSTRAINT "asset_depreciation_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."asset_depreciation_logs"
    ADD CONSTRAINT "asset_depreciation_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_mutations"
    ADD CONSTRAINT "bank_mutations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_mutations"
    ADD CONSTRAINT "bank_mutations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bank_mutations"
    ADD CONSTRAINT "bank_mutations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_mutations"
    ADD CONSTRAINT "bank_mutations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_transactions"
    ADD CONSTRAINT "bank_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pic_employee_id_fkey" FOREIGN KEY ("pic_employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bsc_cycles"
    ADD CONSTRAINT "bsc_cycles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bsc_cycles"
    ADD CONSTRAINT "bsc_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bsc_cycles"
    ADD CONSTRAINT "bsc_cycles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bsc_kpi_measurements"
    ADD CONSTRAINT "bsc_kpi_measurements_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."bsc_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bsc_kpi_measurements"
    ADD CONSTRAINT "bsc_kpi_measurements_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "public"."bsc_kpis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bsc_kpi_measurements"
    ADD CONSTRAINT "bsc_kpi_measurements_measured_by_fkey" FOREIGN KEY ("measured_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bsc_kpis"
    ADD CONSTRAINT "bsc_kpis_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bsc_kpis"
    ADD CONSTRAINT "bsc_kpis_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."bsc_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bsc_perspective_weights"
    ADD CONSTRAINT "bsc_perspective_weights_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."bsc_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coa_account_requests"
    ADD CONSTRAINT "coa_account_requests_created_account_id_fkey" FOREIGN KEY ("created_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coa_account_requests"
    ADD CONSTRAINT "coa_account_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coa_account_requests"
    ADD CONSTRAINT "coa_account_requests_proposed_parent_id_fkey" FOREIGN KEY ("proposed_parent_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coa_account_requests"
    ADD CONSTRAINT "coa_account_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coa_account_requests"
    ADD CONSTRAINT "coa_account_requests_requester_branch_id_fkey" FOREIGN KEY ("requester_branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coa_account_requests"
    ADD CONSTRAINT "coa_account_requests_requester_org_id_fkey" FOREIGN KEY ("requester_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coa_account_requests"
    ADD CONSTRAINT "coa_account_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_components"
    ADD CONSTRAINT "employee_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "public"."payroll_components"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_components"
    ADD CONSTRAINT "employee_components_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_claims"
    ADD CONSTRAINT "expense_claims_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fiscal_periods"
    ADD CONSTRAINT "fiscal_periods_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fiscal_periods"
    ADD CONSTRAINT "fiscal_periods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_accum_dep_account_id_fkey" FOREIGN KEY ("accum_dep_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_asset_account_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_dep_expense_account_id_fkey" FOREIGN KEY ("dep_expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_assets"
    ADD CONSTRAINT "fleet_assets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fleet_assets"
    ADD CONSTRAINT "fleet_assets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_bookings"
    ADD CONSTRAINT "fleet_bookings_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."fleet_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_bookings"
    ADD CONSTRAINT "fleet_bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fleet_bookings"
    ADD CONSTRAINT "fleet_bookings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_bookings"
    ADD CONSTRAINT "fleet_bookings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_maintenance_labs"
    ADD CONSTRAINT "fleet_maintenance_labs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."fleet_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_maintenance_labs"
    ADD CONSTRAINT "fleet_maintenance_labs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fleet_maintenance_labs"
    ADD CONSTRAINT "fleet_maintenance_labs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_routes"
    ADD CONSTRAINT "fleet_routes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fleet_routes"
    ADD CONSTRAINT "fleet_routes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_schedules"
    ADD CONSTRAINT "fleet_schedules_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."fleet_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_schedules"
    ADD CONSTRAINT "fleet_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fleet_schedules"
    ADD CONSTRAINT "fleet_schedules_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_schedules"
    ADD CONSTRAINT "fleet_schedules_helper_id_fkey" FOREIGN KEY ("helper_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_schedules"
    ADD CONSTRAINT "fleet_schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_schedules"
    ADD CONSTRAINT "fleet_schedules_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."fleet_routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_terminals"
    ADD CONSTRAINT "fleet_terminals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fleet_terminals"
    ADD CONSTRAINT "fleet_terminals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_tickets"
    ADD CONSTRAINT "fleet_tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fleet_tickets"
    ADD CONSTRAINT "fleet_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_tickets"
    ADD CONSTRAINT "fleet_tickets_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_tickets"
    ADD CONSTRAINT "fleet_tickets_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."fleet_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intercompany_accounts"
    ADD CONSTRAINT "intercompany_accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intercompany_accounts"
    ADD CONSTRAINT "intercompany_accounts_due_from_account_id_fkey" FOREIGN KEY ("due_from_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intercompany_accounts"
    ADD CONSTRAINT "intercompany_accounts_due_to_account_id_fkey" FOREIGN KEY ("due_to_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intercompany_accounts"
    ADD CONSTRAINT "intercompany_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intercompany_transactions"
    ADD CONSTRAINT "intercompany_transactions_from_branch_id_fkey" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intercompany_transactions"
    ADD CONSTRAINT "intercompany_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intercompany_transactions"
    ADD CONSTRAINT "intercompany_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intercompany_transactions"
    ADD CONSTRAINT "intercompany_transactions_to_branch_id_fkey" FOREIGN KEY ("to_branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjustment_items"
    ADD CONSTRAINT "inventory_adjustment_items_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "public"."inventory_adjustments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjustment_items"
    ADD CONSTRAINT "inventory_adjustment_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjustment_items"
    ADD CONSTRAINT "inventory_adjustment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjustment_items"
    ADD CONSTRAINT "inventory_adjustment_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_adjustments"
    ADD CONSTRAINT "inventory_adjustments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_stocks"
    ADD CONSTRAINT "inventory_stocks_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "public"."warehouse_bins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_stocks"
    ADD CONSTRAINT "inventory_stocks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_stocks"
    ADD CONSTRAINT "inventory_stocks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_stocks"
    ADD CONSTRAINT "inventory_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_stocks"
    ADD CONSTRAINT "inventory_stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_items"
    ADD CONSTRAINT "inventory_transfer_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfer_items"
    ADD CONSTRAINT "inventory_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inventory_transfer_items"
    ADD CONSTRAINT "inventory_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."inventory_transfers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_source_wh_id_fkey" FOREIGN KEY ("source_wh_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_target_wh_id_fkey" FOREIGN KEY ("target_wh_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_lines"
    ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invitations"
    ADD CONSTRAINT "org_invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_member_units"
    ADD CONSTRAINT "org_member_units_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_member_units"
    ADD CONSTRAINT "org_member_units_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_member_units"
    ADD CONSTRAINT "org_member_units_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_member_units"
    ADD CONSTRAINT "org_member_units_org_member_id_fkey" FOREIGN KEY ("org_member_id") REFERENCES "public"."org_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_last_active_branch_id_fkey" FOREIGN KEY ("last_active_branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_members"
    ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_parent_org_id_fkey" FOREIGN KEY ("parent_org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll_components"
    ADD CONSTRAINT "payroll_components_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_components"
    ADD CONSTRAINT "payroll_components_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslip_lines"
    ADD CONSTRAINT "payslip_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslip_lines"
    ADD CONSTRAINT "payslip_lines_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "public"."payroll_components"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslip_lines"
    ADD CONSTRAINT "payslip_lines_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_bom_items"
    ADD CONSTRAINT "production_bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "public"."production_boms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_bom_items"
    ADD CONSTRAINT "production_bom_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_boms"
    ADD CONSTRAINT "production_boms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."production_boms"
    ADD CONSTRAINT "production_boms_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_boms"
    ADD CONSTRAINT "production_boms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_wo_costs"
    ADD CONSTRAINT "production_wo_costs_wo_id_fkey" FOREIGN KEY ("wo_id") REFERENCES "public"."production_work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_work_orders"
    ADD CONSTRAINT "production_work_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "public"."production_boms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_work_orders"
    ADD CONSTRAINT "production_work_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."production_work_orders"
    ADD CONSTRAINT "production_work_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_asset_account_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_income_account_id_fkey" FOREIGN KEY ("income_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_items"
    ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_payments"
    ADD CONSTRAINT "purchase_payments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_requests"
    ADD CONSTRAINT "purchase_requests_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_requests"
    ADD CONSTRAINT "purchase_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_requests"
    ADD CONSTRAINT "purchase_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_requests"
    ADD CONSTRAINT "purchase_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."purchase_return_items"
    ADD CONSTRAINT "purchase_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_return_items"
    ADD CONSTRAINT "purchase_return_items_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "public"."purchase_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_return_items"
    ADD CONSTRAINT "purchase_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "public"."purchase_returns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_returns"
    ADD CONSTRAINT "purchase_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."purchase_returns"
    ADD CONSTRAINT "purchase_returns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_returns"
    ADD CONSTRAINT "purchase_returns_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."reimbursement_items"
    ADD CONSTRAINT "reimbursement_items_category_account_id_fkey" FOREIGN KEY ("category_account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reimbursement_items"
    ADD CONSTRAINT "reimbursement_items_reimbursement_id_fkey" FOREIGN KEY ("reimbursement_id") REFERENCES "public"."reimbursements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reimbursements"
    ADD CONSTRAINT "reimbursements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reimbursements"
    ADD CONSTRAINT "reimbursements_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reimbursements"
    ADD CONSTRAINT "reimbursements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reimbursements"
    ADD CONSTRAINT "reimbursements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_source_org_id_fkey" FOREIGN KEY ("source_org_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_source_role_id_fkey" FOREIGN KEY ("source_role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."saas_invoices"
    ADD CONSTRAINT "saas_invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saas_invoices"
    ADD CONSTRAINT "saas_invoices_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."saas_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."saas_vouchers"
    ADD CONSTRAINT "saas_vouchers_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."saas_packages"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_items"
    ADD CONSTRAINT "sales_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_items"
    ADD CONSTRAINT "sales_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_items"
    ADD CONSTRAINT "sales_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_items"
    ADD CONSTRAINT "sales_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_page_leads"
    ADD CONSTRAINT "sales_page_leads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_page_leads"
    ADD CONSTRAINT "sales_page_leads_sales_page_id_fkey" FOREIGN KEY ("sales_page_id") REFERENCES "public"."sales_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_pages"
    ADD CONSTRAINT "sales_pages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sales_pages"
    ADD CONSTRAINT "sales_pages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_pages"
    ADD CONSTRAINT "sales_pages_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sales_payments"
    ADD CONSTRAINT "sales_payments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_payments"
    ADD CONSTRAINT "sales_payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_payments"
    ADD CONSTRAINT "sales_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sales_payments"
    ADD CONSTRAINT "sales_payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_payments"
    ADD CONSTRAINT "sales_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_return_items"
    ADD CONSTRAINT "sales_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_return_items"
    ADD CONSTRAINT "sales_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "public"."sales_returns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_return_items"
    ADD CONSTRAINT "sales_return_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sales_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_returns"
    ADD CONSTRAINT "sales_returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_returns"
    ADD CONSTRAINT "sales_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sales_returns"
    ADD CONSTRAINT "sales_returns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_returns"
    ADD CONSTRAINT "sales_returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_ticket_updates"
    ADD CONSTRAINT "support_ticket_updates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_ticket_updates"
    ADD CONSTRAINT "support_ticket_updates_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_ticket_updates"
    ADD CONSTRAINT "support_ticket_updates_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."warehouse_bins"
    ADD CONSTRAINT "warehouse_bins_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warehouse_bins"
    ADD CONSTRAINT "warehouse_bins_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zakat_asset_timeline"
    ADD CONSTRAINT "zakat_asset_timeline_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zakat_haul_events"
    ADD CONSTRAINT "zakat_haul_events_haul_id_fkey" FOREIGN KEY ("haul_id") REFERENCES "public"."zakat_haul"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zakat_haul"
    ADD CONSTRAINT "zakat_haul_gold_price_set_by_fkey" FOREIGN KEY ("gold_price_set_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."zakat_haul"
    ADD CONSTRAINT "zakat_haul_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admin write for saas_config" ON "public"."saas_config" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Allow members with config access to manage invitations" ON "public"."org_invitations" USING ((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "org_invitations"."org_id") AND ("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"]))))));



CREATE POLICY "Allow public to read invitation by code" ON "public"."org_invitations" FOR SELECT TO "authenticated", "anon" USING (("is_active" AND (("expires_at" IS NULL) OR ("expires_at" > "now"()))));



CREATE POLICY "Anyone can select organizations" ON "public"."organizations" FOR SELECT USING (true);



CREATE POLICY "Full access for saas_config" ON "public"."saas_config" USING (true);



CREATE POLICY "Members can view their organizations" ON "public"."organizations" FOR SELECT USING (true);



CREATE POLICY "Org members can manage purchase items" ON "public"."purchase_items" USING (("public"."nizam_has_permission"('purchasing:write'::"text", "org_id") AND (EXISTS ( SELECT 1
   FROM "public"."purchases" "p"
  WHERE (("p"."id" = "purchase_items"."purchase_id") AND ("p"."org_id" = "purchase_items"."org_id") AND "public"."can_access_branch_or_default"("p"."org_id", "p"."branch_id")))))) WITH CHECK (("public"."nizam_has_permission"('purchasing:write'::"text", "org_id") AND (EXISTS ( SELECT 1
   FROM "public"."purchases" "p"
  WHERE (("p"."id" = "purchase_items"."purchase_id") AND ("p"."org_id" = "purchase_items"."org_id") AND "public"."can_access_branch_or_default"("p"."org_id", "p"."branch_id"))))));



CREATE POLICY "Org members can manage sales items" ON "public"."sales_items" USING (("public"."nizam_has_permission"('sales:write'::"text", "org_id") AND (EXISTS ( SELECT 1
   FROM "public"."sales" "s"
  WHERE (("s"."id" = "sales_items"."sale_id") AND ("s"."org_id" = "sales_items"."org_id") AND "public"."can_access_branch_or_default"("s"."org_id", COALESCE("sales_items"."branch_id", "s"."branch_id"))))))) WITH CHECK (("public"."nizam_has_permission"('sales:write'::"text", "org_id") AND (EXISTS ( SELECT 1
   FROM "public"."sales" "s"
  WHERE (("s"."id" = "sales_items"."sale_id") AND ("s"."org_id" = "sales_items"."org_id") AND "public"."can_access_branch_or_default"("s"."org_id", COALESCE("sales_items"."branch_id", "s"."branch_id")))))));



CREATE POLICY "Org members can view purchase items" ON "public"."purchase_items" FOR SELECT USING (("public"."nizam_has_permission"('purchasing:read'::"text", "org_id") AND (EXISTS ( SELECT 1
   FROM "public"."purchases" "p"
  WHERE (("p"."id" = "purchase_items"."purchase_id") AND ("p"."org_id" = "purchase_items"."org_id") AND "public"."can_access_branch_or_default"("p"."org_id", "p"."branch_id"))))));



CREATE POLICY "Org members can view sales items" ON "public"."sales_items" FOR SELECT USING (("public"."nizam_has_permission"('sales:read'::"text", "org_id") AND (EXISTS ( SELECT 1
   FROM "public"."sales" "s"
  WHERE (("s"."id" = "sales_items"."sale_id") AND ("s"."org_id" = "sales_items"."org_id") AND "public"."can_access_branch_or_default"("s"."org_id", COALESCE("sales_items"."branch_id", "s"."branch_id")))))));



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."saas_packages" FOR SELECT USING (true);



CREATE POLICY "Public read for saas_config" ON "public"."saas_config" FOR SELECT USING (true);



CREATE POLICY "Users can create invoices for their own org" ON "public"."saas_invoices" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "saas_invoices"."org_id") AND ("org_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own invoices" ON "public"."saas_invoices" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "saas_invoices"."org_id") AND ("org_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view invoices for their own org" ON "public"."saas_invoices" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "saas_invoices"."org_id") AND ("org_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "admin_manage_attendance" ON "public"."attendance" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"]))))));



CREATE POLICY "admin_manage_emp_components" ON "public"."employee_components" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."org_id" IN ( SELECT "org_members"."org_id"
           FROM "public"."org_members"
          WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"]))))))));



CREATE POLICY "admin_manage_hr" ON "public"."employees" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"]))))));



CREATE POLICY "admin_manage_payroll" ON "public"."payroll_runs" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "admin_manage_payroll_components" ON "public"."payroll_components" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"]))))));



CREATE POLICY "admin_manage_payslip_lines" ON "public"."payslip_lines" USING (("payslip_id" IN ( SELECT "p"."id"
   FROM ("public"."payslips" "p"
     JOIN "public"."payroll_runs" "r" ON (("p"."run_id" = "r"."id")))
  WHERE (("p"."branch_id" IS NOT NULL) AND "public"."can_access_branch"("r"."org_id", "p"."branch_id") AND ("r"."org_id" IN ( SELECT "org_members"."org_id"
           FROM "public"."org_members"
          WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))))) WITH CHECK (("payslip_id" IN ( SELECT "p"."id"
   FROM ("public"."payslips" "p"
     JOIN "public"."payroll_runs" "r" ON (("p"."run_id" = "r"."id")))
  WHERE (("p"."branch_id" IS NOT NULL) AND "public"."can_access_branch"("r"."org_id", "p"."branch_id") AND ("r"."org_id" IN ( SELECT "org_members"."org_id"
           FROM "public"."org_members"
          WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true))))))));



CREATE POLICY "admin_manage_payslips" ON "public"."payslips" USING ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"(( SELECT "r"."org_id"
   FROM "public"."payroll_runs" "r"
  WHERE ("r"."id" = "payslips"."run_id")), "branch_id") AND (EXISTS ( SELECT 1
   FROM ("public"."payroll_runs" "r"
     JOIN "public"."org_members" "om" ON (("om"."org_id" = "r"."org_id")))
  WHERE (("r"."id" = "payslips"."run_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("om"."is_active" = true)))))) WITH CHECK ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"(( SELECT "r"."org_id"
   FROM "public"."payroll_runs" "r"
  WHERE ("r"."id" = "payslips"."run_id")), "branch_id") AND (EXISTS ( SELECT 1
   FROM ("public"."payroll_runs" "r"
     JOIN "public"."org_members" "om" ON (("om"."org_id" = "r"."org_id")))
  WHERE (("r"."id" = "payslips"."run_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("om"."is_active" = true))))));



CREATE POLICY "admins_can_manage_accounts" ON "public"."accounts" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "admins_can_manage_asset_depreciation_logs" ON "public"."asset_depreciation_logs" USING (((EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "asset_depreciation_logs"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true)))) AND "public"."can_access_branch"("org_id", "branch_id"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "asset_depreciation_logs"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true)))) AND "public"."can_access_branch"("org_id", "branch_id")));



CREATE POLICY "admins_can_manage_assets" ON "public"."fixed_assets" USING (((EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "fixed_assets"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true)))) AND "public"."can_access_branch"("org_id", "branch_id"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "fixed_assets"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true)))) AND "public"."can_access_branch"("org_id", "branch_id")));



CREATE POLICY "admins_can_manage_bank_accounts" ON "public"."bank_accounts" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "admins_can_manage_bom_items" ON "public"."production_bom_items" USING ((EXISTS ( SELECT 1
   FROM ("public"."production_boms" "b"
     JOIN "public"."org_members" "om" ON (("om"."org_id" = "b"."org_id")))
  WHERE (("b"."id" = "production_bom_items"."bom_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true) AND (("b"."branch_id" IS NULL) OR "public"."can_access_branch"("b"."org_id", "b"."branch_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."production_boms" "b"
     JOIN "public"."org_members" "om" ON (("om"."org_id" = "b"."org_id")))
  WHERE (("b"."id" = "production_bom_items"."bom_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true) AND (("b"."branch_id" IS NULL) OR "public"."can_access_branch"("b"."org_id", "b"."branch_id"))))));



CREATE POLICY "admins_can_manage_bookings" ON "public"."fleet_bookings" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "admins_can_manage_branches" ON "public"."branches" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "admins_can_manage_fiscal_periods" ON "public"."fiscal_periods" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "admins_can_manage_fleet" ON "public"."fleet_assets" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "admins_can_manage_fleet_medical_records" ON "public"."fleet_maintenance_labs" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "admins_can_manage_members" ON "public"."org_members" USING ("public"."is_org_admin"("org_id")) WITH CHECK ("public"."is_org_admin"("org_id"));



CREATE POLICY "admins_can_manage_org_member_units" ON "public"."org_member_units" USING ("public"."is_org_admin"("org_id")) WITH CHECK ("public"."is_org_admin"("org_id"));



CREATE POLICY "admins_can_manage_production" ON "public"."production_boms" USING ((("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))) AND (("branch_id" IS NULL) OR "public"."can_access_branch"("org_id", "branch_id")))) WITH CHECK ((("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))) AND (("branch_id" IS NULL) OR "public"."can_access_branch"("org_id", "branch_id"))));



CREATE POLICY "admins_can_manage_roles" ON "public"."roles" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "admins_can_manage_warehouses" ON "public"."warehouses" USING (("public"."can_access_branch_or_default"("org_id", "branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "warehouses"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch_or_default"("org_id", "branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "warehouses"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true))))));



CREATE POLICY "admins_can_manage_wo" ON "public"."production_work_orders" USING ((("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))) AND ("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id"))) WITH CHECK ((("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))) AND ("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id")));



CREATE POLICY "admins_can_manage_wo_costs" ON "public"."production_wo_costs" USING ((EXISTS ( SELECT 1
   FROM ("public"."production_work_orders" "wo"
     JOIN "public"."org_members" "om" ON (("om"."org_id" = "wo"."org_id")))
  WHERE (("wo"."id" = "production_wo_costs"."wo_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true) AND ("wo"."branch_id" IS NOT NULL) AND "public"."can_access_branch"("wo"."org_id", "wo"."branch_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."production_work_orders" "wo"
     JOIN "public"."org_members" "om" ON (("om"."org_id" = "wo"."org_id")))
  WHERE (("wo"."id" = "production_wo_costs"."wo_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true) AND ("wo"."branch_id" IS NOT NULL) AND "public"."can_access_branch"("wo"."org_id", "wo"."branch_id")))));



CREATE POLICY "admins_can_view_org_member_units" ON "public"."org_member_units" FOR SELECT USING ("public"."is_org_admin"("org_id"));



CREATE POLICY "admins_can_view_org_members" ON "public"."org_members" FOR SELECT USING ("public"."is_org_admin"("org_id"));



CREATE POLICY "admins_manage_branches" ON "public"."branches" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"])) AND ("org_members"."is_active" = true))))) WITH CHECK (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "admins_manage_intercompany_accounts" ON "public"."intercompany_accounts" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "admins_manage_intercompany_tx" ON "public"."intercompany_transactions" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "admins_manage_routes" ON "public"."fleet_routes" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "admins_manage_schedules" ON "public"."fleet_schedules" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "admins_manage_terminals" ON "public"."fleet_terminals" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "admins_manage_tickets" ON "public"."fleet_tickets" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



ALTER TABLE "public"."ai_token_topup_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_token_topup_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_token_usage_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_token_wallets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_topup_order_insert" ON "public"."ai_token_topup_orders" FOR INSERT WITH CHECK (("public"."is_platform_admin"() OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "ai_topup_order_select" ON "public"."ai_token_topup_orders" FOR SELECT USING (("public"."is_platform_admin"() OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "ai_topup_order_update" ON "public"."ai_token_topup_orders" FOR UPDATE USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "ai_topup_pkg_manage" ON "public"."ai_token_topup_packages" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "ai_topup_pkg_select" ON "public"."ai_token_topup_packages" FOR SELECT USING (true);



CREATE POLICY "ai_usage_insert" ON "public"."ai_token_usage_logs" FOR INSERT WITH CHECK (("public"."is_platform_admin"() OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "ai_usage_select" ON "public"."ai_token_usage_logs" FOR SELECT USING (("public"."is_platform_admin"() OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "ai_wallet_insert" ON "public"."ai_token_wallets" FOR INSERT WITH CHECK (("public"."is_platform_admin"() OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "ai_wallet_select" ON "public"."ai_token_wallets" FOR SELECT USING (("public"."is_platform_admin"() OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "ai_wallet_update" ON "public"."ai_token_wallets" FOR UPDATE USING (("public"."is_platform_admin"() OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."is_platform_admin"() OR ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



ALTER TABLE "public"."asset_depreciation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_can_submit_requests" ON "public"."coa_account_requests" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_mutations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branch_managers_manage_branch_attendance" ON "public"."attendance" USING ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "branch_managers_manage_branch_employees" ON "public"."employees" USING ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "branch_managers_manage_branch_expenses" ON "public"."expense_claims" USING ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "branch_managers_manage_branch_leaves" ON "public"."leave_requests" USING ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK ((("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'hr'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bsc_cycles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bsc_kpi_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bsc_kpis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bsc_perspective_weights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coa_account_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emp_view_attendance" ON "public"."attendance" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "emp_view_own_components" ON "public"."employee_components" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "emp_view_own_payslip_lines" ON "public"."payslip_lines" FOR SELECT USING (("payslip_id" IN ( SELECT "payslips"."id"
   FROM "public"."payslips"
  WHERE ("payslips"."employee_id" IN ( SELECT "employees"."id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"()))))));



CREATE POLICY "emp_view_payslip" ON "public"."payslips" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "emp_view_self" ON "public"."employees" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."employee_components" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_manage_own_branch_attendance" ON "public"."attendance" USING (("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."org_id" = "attendance"."org_id") AND ("e"."branch_id" = "attendance"."branch_id"))))) WITH CHECK (("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."org_id" = "attendance"."org_id") AND ("e"."branch_id" = "attendance"."branch_id")))));



CREATE POLICY "employees_manage_own_branch_expenses" ON "public"."expense_claims" USING (("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."org_id" = "expense_claims"."org_id") AND ("e"."branch_id" = "expense_claims"."branch_id"))))) WITH CHECK (("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."org_id" = "expense_claims"."org_id") AND ("e"."branch_id" = "expense_claims"."branch_id")))));



CREATE POLICY "employees_manage_own_branch_leaves" ON "public"."leave_requests" USING (("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."org_id" = "leave_requests"."org_id") AND ("e"."branch_id" = "leave_requests"."branch_id"))))) WITH CHECK (("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."org_id" = "leave_requests"."org_id") AND ("e"."branch_id" = "leave_requests"."branch_id")))));



ALTER TABLE "public"."expense_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fiscal_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fixed_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_maintenance_labs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_terminals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intercompany_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intercompany_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_adjustment_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_stocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transfer_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "managers_can_delete_bank_transactions" ON "public"."bank_transactions" FOR DELETE USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "managers_can_manage_inventory_stocks" ON "public"."inventory_stocks" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "managers_can_manage_products" ON "public"."products" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "managers_can_post_or_void" ON "public"."journal_entries" FOR UPDATE USING (("public"."can_access_branch_or_default"("org_id", "branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "journal_entries"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch_or_default"("org_id", "branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "journal_entries"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("om"."is_active" = true))))));



CREATE POLICY "managers_can_update_bank_transactions" ON "public"."bank_transactions" FOR UPDATE USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "member_insert_v3" ON "public"."org_members" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "member_manage_v3" ON "public"."org_members" USING ("public"."is_org_admin_v3"("org_id"));



CREATE POLICY "member_select_v3" ON "public"."org_members" FOR SELECT USING (("org_id" IN ( SELECT "public"."get_my_org_ids_v3"() AS "get_my_org_ids_v3")));



CREATE POLICY "members_can_create_approvals" ON "public"."approval_requests" FOR INSERT WITH CHECK ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_create_requests" ON "public"."purchase_requests" FOR INSERT WITH CHECK ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_create_transfers" ON "public"."inventory_transfers" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_delete_contacts" ON "public"."contacts" FOR DELETE USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_delete_draft_journal" ON "public"."journal_entries" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "journal_entries"."org_id") AND ("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true)))) AND ("status" = 'DRAFT'::"public"."journal_status")));



CREATE POLICY "members_can_delete_purchases" ON "public"."purchases" FOR DELETE USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_delete_sales" ON "public"."sales" FOR DELETE USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_insert_contacts" ON "public"."contacts" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_insert_purchases" ON "public"."purchases" FOR INSERT WITH CHECK ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_insert_sales" ON "public"."sales" FOR INSERT WITH CHECK ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_manage_bins" ON "public"."warehouse_bins" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_manage_budgets" ON "public"."budgets" USING ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND (COALESCE("branch_id", "public"."resolve_single_active_branch"("org_id")) IS NOT NULL) AND "public"."can_access_branch"("org_id", COALESCE("branch_id", "public"."resolve_single_active_branch"("org_id"))))) WITH CHECK ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND (COALESCE("branch_id", "public"."resolve_single_active_branch"("org_id")) IS NOT NULL) AND "public"."can_access_branch"("org_id", COALESCE("branch_id", "public"."resolve_single_active_branch"("org_id")))));



CREATE POLICY "members_can_manage_return_items" ON "public"."sales_return_items" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_returns" "sr"
  WHERE (("sr"."id" = "sales_return_items"."return_id") AND "public"."can_access_branch_or_default"("sr"."org_id", "sr"."branch_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sales_returns" "sr"
  WHERE (("sr"."id" = "sales_return_items"."return_id") AND "public"."can_access_branch_or_default"("sr"."org_id", "sr"."branch_id")))));



CREATE POLICY "members_can_manage_returns" ON "public"."sales_returns" USING ("public"."can_access_branch_or_default"("org_id", "branch_id")) WITH CHECK ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_manage_sales_page_leads" ON "public"."sales_page_leads" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true))))) WITH CHECK (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_manage_sales_pages" ON "public"."sales_pages" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true))))) WITH CHECK (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_manage_service_orders" ON "public"."service_orders" USING ("public"."can_access_branch"("org_id", "branch_id")) WITH CHECK ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "members_can_manage_wo_costs" ON "public"."production_wo_costs" USING (("wo_id" IN ( SELECT "production_work_orders"."id"
   FROM "public"."production_work_orders"
  WHERE ("production_work_orders"."org_id" IN ( SELECT "org_members"."org_id"
           FROM "public"."org_members"
          WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))))));



CREATE POLICY "members_can_manage_zakat_timeline" ON "public"."zakat_asset_timeline" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_update_contacts" ON "public"."contacts" FOR UPDATE USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_update_purchases" ON "public"."purchases" FOR UPDATE USING ("public"."can_access_branch_or_default"("org_id", "branch_id")) WITH CHECK ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_update_requests" ON "public"."purchase_requests" FOR UPDATE USING ("public"."can_access_branch_or_default"("org_id", "branch_id")) WITH CHECK ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_update_sales" ON "public"."sales" FOR UPDATE USING ("public"."can_access_branch_or_default"("org_id", "branch_id")) WITH CHECK ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_accounts" ON "public"."accounts" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_asset_depreciation_logs" ON "public"."asset_depreciation_logs" FOR SELECT USING ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND "public"."can_access_branch"("org_id", "branch_id")));



CREATE POLICY "members_can_view_assets" ON "public"."fixed_assets" FOR SELECT USING ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND "public"."can_access_branch"("org_id", "branch_id")));



CREATE POLICY "members_can_view_bank_accounts" ON "public"."bank_accounts" FOR SELECT USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "members_can_view_bank_mutations" ON "public"."bank_mutations" FOR SELECT USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "members_can_view_bank_transactions" ON "public"."bank_transactions" FOR SELECT USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true))))));



CREATE POLICY "members_can_view_bins" ON "public"."warehouse_bins" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_bom_items" ON "public"."production_bom_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."production_boms" "b"
  WHERE (("b"."id" = "production_bom_items"."bom_id") AND ("b"."org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND (("b"."branch_id" IS NULL) OR "public"."can_access_branch"("b"."org_id", "b"."branch_id"))))));



CREATE POLICY "members_can_view_bookings" ON "public"."fleet_bookings" FOR SELECT USING ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "members_can_view_branches" ON "public"."branches" FOR SELECT USING ("public"."can_access_branch"("org_id", "id"));



CREATE POLICY "members_can_view_budgets" ON "public"."budgets" FOR SELECT USING ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND (("branch_id" IS NULL) OR "public"."can_access_branch"("org_id", "branch_id"))));



CREATE POLICY "members_can_view_fiscal_periods" ON "public"."fiscal_periods" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_fleet" ON "public"."fleet_assets" FOR SELECT USING ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "members_can_view_fleet_medical_records" ON "public"."fleet_maintenance_labs" FOR SELECT USING ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "members_can_view_inventory_stocks" ON "public"."inventory_stocks" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_journal" ON "public"."journal_entries" FOR SELECT USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_journal_lines" ON "public"."journal_lines" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_lines"."entry_id") AND "public"."can_access_branch_or_default"("je"."org_id", "je"."branch_id")))));



CREATE POLICY "members_can_view_movements" ON "public"."stock_movements" FOR SELECT USING (true);



CREATE POLICY "members_can_view_own_org_member_units" ON "public"."org_member_units" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."id" = "org_member_units"."org_member_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true)))));



CREATE POLICY "members_can_view_payments" ON "public"."sales_payments" FOR SELECT USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_production" ON "public"."production_boms" FOR SELECT USING ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND (("branch_id" IS NULL) OR "public"."can_access_branch"("org_id", "branch_id"))));



CREATE POLICY "members_can_view_products" ON "public"."products" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_purchases" ON "public"."purchases" FOR SELECT USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_reimbursement_items" ON "public"."reimbursement_items" FOR SELECT USING (("reimbursement_id" IN ( SELECT "reimbursements"."id"
   FROM "public"."reimbursements"
  WHERE ("reimbursements"."org_id" IN ( SELECT "org_members"."org_id"
           FROM "public"."org_members"
          WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))))));



CREATE POLICY "members_can_view_reimbursements" ON "public"."reimbursements" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_relevant_approvals" ON "public"."approval_requests" FOR SELECT USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_requests" ON "public"."purchase_requests" FOR SELECT USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_return_items" ON "public"."sales_return_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sales_returns" "sr"
  WHERE (("sr"."id" = "sales_return_items"."return_id") AND "public"."can_access_branch_or_default"("sr"."org_id", "sr"."branch_id")))));



CREATE POLICY "members_can_view_returns" ON "public"."sales_returns" FOR SELECT USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_roles" ON "public"."roles" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_sales" ON "public"."sales" FOR SELECT USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_sales_page_leads" ON "public"."sales_page_leads" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_sales_pages" ON "public"."sales_pages" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_sales_purchases" ON "public"."contacts" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_service_orders" ON "public"."service_orders" FOR SELECT USING ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "members_can_view_transfer_items" ON "public"."inventory_transfer_items" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_transfers" ON "public"."inventory_transfers" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_can_view_warehouses" ON "public"."warehouses" FOR SELECT USING ("public"."can_access_branch_or_default"("org_id", "branch_id"));



CREATE POLICY "members_can_view_wo" ON "public"."production_work_orders" FOR SELECT USING ((("org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND ("branch_id" IS NOT NULL) AND "public"."can_access_branch"("org_id", "branch_id")));



CREATE POLICY "members_can_view_wo_costs" ON "public"."production_wo_costs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."production_work_orders" "wo"
  WHERE (("wo"."id" = "production_wo_costs"."wo_id") AND ("wo"."org_id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")) AND ("wo"."branch_id" IS NOT NULL) AND "public"."can_access_branch"("wo"."org_id", "wo"."branch_id")))));



CREATE POLICY "members_create_support_tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK ((("reporter_user_id" = "auth"."uid"()) AND ("org_id" IN ( SELECT "om"."org_id"
   FROM "public"."org_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "members_manage_bsc_cycles" ON "public"."bsc_cycles" USING ("public"."nizam_has_permission"('strategy:write'::"text", "org_id")) WITH CHECK ("public"."nizam_has_permission"('strategy:write'::"text", "org_id"));



CREATE POLICY "members_manage_bsc_kpis" ON "public"."bsc_kpis" USING ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_kpis"."cycle_id") AND "public"."nizam_has_permission"('strategy:write'::"text", "c"."org_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_kpis"."cycle_id") AND "public"."nizam_has_permission"('strategy:write'::"text", "c"."org_id")))));



CREATE POLICY "members_manage_bsc_measurements" ON "public"."bsc_kpi_measurements" USING ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_kpi_measurements"."cycle_id") AND "public"."nizam_has_permission"('strategy:write'::"text", "c"."org_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_kpi_measurements"."cycle_id") AND "public"."nizam_has_permission"('strategy:write'::"text", "c"."org_id")))));



CREATE POLICY "members_manage_bsc_perspective_weights" ON "public"."bsc_perspective_weights" USING ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_perspective_weights"."cycle_id") AND "public"."nizam_has_permission"('strategy:write'::"text", "c"."org_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_perspective_weights"."cycle_id") AND "public"."nizam_has_permission"('strategy:write'::"text", "c"."org_id")))));



CREATE POLICY "members_view_adj" ON "public"."inventory_adjustments" FOR SELECT USING (true);



CREATE POLICY "members_view_adj_items" ON "public"."inventory_adjustment_items" FOR SELECT USING (true);



CREATE POLICY "members_view_bsc_cycles" ON "public"."bsc_cycles" FOR SELECT USING (("public"."nizam_has_permission"('strategy:read'::"text", "org_id") OR "public"."nizam_has_permission"('reports:read'::"text", "org_id")));



CREATE POLICY "members_view_bsc_kpis" ON "public"."bsc_kpis" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_kpis"."cycle_id") AND ("public"."nizam_has_permission"('strategy:read'::"text", "c"."org_id") OR "public"."nizam_has_permission"('reports:read'::"text", "c"."org_id"))))));



CREATE POLICY "members_view_bsc_measurements" ON "public"."bsc_kpi_measurements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_kpi_measurements"."cycle_id") AND ("public"."nizam_has_permission"('strategy:read'::"text", "c"."org_id") OR "public"."nizam_has_permission"('reports:read'::"text", "c"."org_id"))))));



CREATE POLICY "members_view_bsc_perspective_weights" ON "public"."bsc_perspective_weights" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bsc_cycles" "c"
  WHERE (("c"."id" = "bsc_perspective_weights"."cycle_id") AND ("public"."nizam_has_permission"('strategy:read'::"text", "c"."org_id") OR "public"."nizam_has_permission"('reports:read'::"text", "c"."org_id"))))));



CREATE POLICY "members_view_intercompany_accounts" ON "public"."intercompany_accounts" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_view_intercompany_tx" ON "public"."intercompany_transactions" FOR SELECT USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "members_view_public_support_ticket_updates" ON "public"."support_ticket_updates" FOR SELECT USING ((("is_public" = true) AND ("org_id" IN ( SELECT "om"."org_id"
   FROM "public"."org_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true))))));



CREATE POLICY "members_view_routes" ON "public"."fleet_routes" FOR SELECT USING ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "members_view_schedules" ON "public"."fleet_schedules" FOR SELECT USING ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "members_view_support_tickets" ON "public"."support_tickets" FOR SELECT USING (("org_id" IN ( SELECT "om"."org_id"
   FROM "public"."org_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true)))));



CREATE POLICY "members_view_terminals" ON "public"."fleet_terminals" FOR SELECT USING ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "members_view_tickets" ON "public"."fleet_tickets" FOR SELECT USING ("public"."can_access_branch"("org_id", "branch_id"));



CREATE POLICY "no_direct_delete" ON "public"."coa_account_requests" FOR DELETE USING (false);



CREATE POLICY "no_direct_update" ON "public"."coa_account_requests" FOR UPDATE USING (false);



CREATE POLICY "org_insert_v3" ON "public"."organizations" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."org_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_member_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_select_v3" ON "public"."organizations" FOR SELECT USING (("id" IN ( SELECT "public"."get_my_org_ids_v3"() AS "get_my_org_ids_v3")));



CREATE POLICY "org_update_v3" ON "public"."organizations" FOR UPDATE USING ("public"."is_org_admin_v3"("id"));



CREATE POLICY "org_zakat_haul" ON "public"."zakat_haul" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "org_zakat_haul_events" ON "public"."zakat_haul_events" USING (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "owner_admin_update_support_tickets" ON "public"."support_tickets" FOR UPDATE USING (("org_id" IN ( SELECT "om"."org_id"
   FROM "public"."org_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"])))))) WITH CHECK (("org_id" IN ( SELECT "om"."org_id"
   FROM "public"."org_members" "om"
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("om"."is_active" = true) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role"]))))));



CREATE POLICY "owners_can_delete_org" ON "public"."organizations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."org_members"
  WHERE (("org_members"."org_id" = "organizations"."id") AND ("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = 'owner'::"public"."member_role") AND ("org_members"."is_active" = true)))));



CREATE POLICY "owners_can_delete_own_membership" ON "public"."org_members" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "parent_can_see_all_requests" ON "public"."coa_account_requests" FOR SELECT USING (("public"."is_org_admin"("org_id") OR "public"."can_manage_finance_master"("org_id")));



ALTER TABLE "public"."payroll_components" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payslip_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payslips" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permissive_insert_orgs" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "permissive_select_orgs" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



CREATE POLICY "permissive_update_orgs" ON "public"."organizations" FOR UPDATE TO "authenticated" USING (("id" IN ( SELECT "public"."get_my_org_ids"() AS "get_my_org_ids")));



ALTER TABLE "public"."production_bom_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_boms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_wo_costs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_work_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reimbursement_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reimbursements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "requester_can_see_own_requests" ON "public"."coa_account_requests" FOR SELECT USING (("requested_by" = "auth"."uid"()));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saas_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saas_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saas_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saas_packages_delete" ON "public"."saas_packages" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "saas_packages_insert" ON "public"."saas_packages" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "saas_packages_select" ON "public"."saas_packages" FOR SELECT USING (true);



CREATE POLICY "saas_packages_update" ON "public"."saas_packages" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_page_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_can_create_bank_transactions" ON "public"."bank_transactions" FOR INSERT WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "staff_can_create_draft_journal" ON "public"."journal_entries" FOR INSERT WITH CHECK (("public"."can_access_branch_or_default"("org_id", "branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."org_members" "om"
  WHERE (("om"."org_id" = "journal_entries"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("om"."is_active" = true))))));



CREATE POLICY "staff_can_manage_bank_mutations" ON "public"."bank_mutations" USING (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true)))))) WITH CHECK (("public"."can_access_branch"("org_id", "branch_id") AND ("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("org_members"."is_active" = true))))));



CREATE POLICY "staff_can_manage_draft_lines" ON "public"."journal_lines" USING ((EXISTS ( SELECT 1
   FROM ("public"."journal_entries" "je"
     JOIN "public"."org_members" "om" ON (("om"."org_id" = "je"."org_id")))
  WHERE (("je"."id" = "journal_lines"."entry_id") AND ("je"."status" = 'DRAFT'::"public"."journal_status") AND "public"."can_access_branch_or_default"("je"."org_id", "je"."branch_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("om"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."journal_entries" "je"
     JOIN "public"."org_members" "om" ON (("om"."org_id" = "je"."org_id")))
  WHERE (("je"."id" = "journal_lines"."entry_id") AND ("je"."status" = 'DRAFT'::"public"."journal_status") AND "public"."can_access_branch_or_default"("je"."org_id", "je"."branch_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."member_role", 'admin'::"public"."member_role", 'manager'::"public"."member_role", 'staff'::"public"."member_role"])) AND ("om"."is_active" = true)))));



CREATE POLICY "staff_manage_adj" ON "public"."inventory_adjustments" USING (true);



CREATE POLICY "staff_manage_adj_items" ON "public"."inventory_adjustment_items" USING (true);



ALTER TABLE "public"."support_ticket_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_can_create_reimbursements" ON "public"."reimbursements" FOR INSERT WITH CHECK (("org_id" IN ( SELECT "org_members"."org_id"
   FROM "public"."org_members"
  WHERE (("org_members"."user_id" = "auth"."uid"()) AND ("org_members"."is_active" = true)))));



CREATE POLICY "users_can_insert_their_items" ON "public"."reimbursement_items" FOR INSERT WITH CHECK (("reimbursement_id" IN ( SELECT "reimbursements"."id"
   FROM "public"."reimbursements"
  WHERE (("reimbursements"."user_id" = "auth"."uid"()) AND ("reimbursements"."status" = 'PENDING'::"text")))));



CREATE POLICY "users_can_view_own_membership" ON "public"."org_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."warehouse_bins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zakat_asset_timeline" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zakat_haul" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zakat_haul_events" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric, "p_batch_number" "text", "p_bin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric, "p_batch_number" "text", "p_bin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adjust_inventory_stock"("p_org_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_diff" numeric, "p_batch_number" "text", "p_bin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_coa_request"("p_request_id" "uuid", "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_coa_request"("p_request_id" "uuid", "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_coa_request"("p_request_id" "uuid", "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_journal_bank_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_journal_bank_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_journal_bank_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bootstrap_main_branch_on_org_create"() TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_main_branch_on_org_create"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_main_branch_on_org_create"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bootstrap_org_member_units"() TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_org_member_units"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_org_member_units"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bootstrap_single_branch_member_units"() TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_single_branch_member_units"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_single_branch_member_units"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bsc_calculate_achievement_percent"("p_actual" numeric, "p_target" numeric, "p_direction" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bsc_calculate_achievement_percent"("p_actual" numeric, "p_target" numeric, "p_direction" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bsc_calculate_achievement_percent"("p_actual" numeric, "p_target" numeric, "p_direction" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bsc_score_100_from_achievement"("p_achievement" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."bsc_score_100_from_achievement"("p_achievement" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bsc_score_100_from_achievement"("p_achievement" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."bsc_score_4_from_score_100"("p_score_100" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."bsc_score_4_from_score_100"("p_score_100" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bsc_score_4_from_score_100"("p_score_100" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_branch"("p_org_id" "uuid", "p_branch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_branch"("p_org_id" "uuid", "p_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_branch"("p_org_id" "uuid", "p_branch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_branch_or_default"("p_org_id" "uuid", "p_branch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_branch_or_default"("p_org_id" "uuid", "p_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_branch_or_default"("p_org_id" "uuid", "p_branch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_finance_master"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_finance_master"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_finance_master"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_coa_request"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_coa_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_coa_request"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_closed_period"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_closed_period"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_closed_period"() TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_measurement_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_measurement_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_measurement_quantity"("p_quantity" numeric, "p_from_unit" "text", "p_to_unit" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_fleet_medical_record"("p_org_id" "uuid", "p_asset_id" "uuid", "p_service_date" "date", "p_description" "text", "p_maintenance_type" "text", "p_cost" numeric, "p_odometer_at" numeric, "p_technician_name" "text", "p_vendor_name" "text", "p_parts_replaced" "jsonb", "p_next_service_km" numeric, "p_next_service_date" "date", "p_attachment_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_fleet_medical_record"("p_org_id" "uuid", "p_asset_id" "uuid", "p_service_date" "date", "p_description" "text", "p_maintenance_type" "text", "p_cost" numeric, "p_odometer_at" numeric, "p_technician_name" "text", "p_vendor_name" "text", "p_parts_replaced" "jsonb", "p_next_service_km" numeric, "p_next_service_date" "date", "p_attachment_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_fleet_medical_record"("p_org_id" "uuid", "p_asset_id" "uuid", "p_service_date" "date", "p_description" "text", "p_maintenance_type" "text", "p_cost" numeric, "p_odometer_at" numeric, "p_technician_name" "text", "p_vendor_name" "text", "p_parts_replaced" "jsonb", "p_next_service_km" numeric, "p_next_service_date" "date", "p_attachment_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_interorg_capital_transfer"("p_source_org_id" "uuid", "p_source_bank_account_id" "uuid", "p_source_counter_account_id" "uuid", "p_target_bank_account_id" "uuid", "p_target_counter_account_id" "uuid", "p_transaction_date" "date", "p_amount" numeric, "p_description" "text", "p_reference_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_interorg_capital_transfer"("p_source_org_id" "uuid", "p_source_bank_account_id" "uuid", "p_source_counter_account_id" "uuid", "p_target_bank_account_id" "uuid", "p_target_counter_account_id" "uuid", "p_transaction_date" "date", "p_amount" numeric, "p_description" "text", "p_reference_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_interorg_capital_transfer"("p_source_org_id" "uuid", "p_source_bank_account_id" "uuid", "p_source_counter_account_id" "uuid", "p_target_bank_account_id" "uuid", "p_target_counter_account_id" "uuid", "p_transaction_date" "date", "p_amount" numeric, "p_description" "text", "p_reference_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_org_inventory"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."debug_org_inventory"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_org_inventory"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_org_cascade"("target_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_org_cascade"("target_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_org_cascade"("target_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_accounts_delete_governance"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_accounts_delete_governance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_accounts_delete_governance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_accounts_governance"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_accounts_governance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_accounts_governance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_accounts_governance_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_accounts_governance_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_accounts_governance_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_coa_request_governance"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_coa_request_governance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_coa_request_governance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_inventory_segment_accounts"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_inventory_segment_accounts"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_inventory_segment_accounts"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_istishna_liability_account"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_istishna_liability_account"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_istishna_liability_account"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_istishna_vendor_asset_account"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_istishna_vendor_asset_account"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_istishna_vendor_asset_account"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_main_branch_for_org"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_main_branch_for_org"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_main_branch_for_org"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_salam_liability_account"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_salam_liability_account"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_salam_liability_account"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_salam_vendor_receivable_account"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_salam_vendor_receivable_account"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_salam_vendor_receivable_account"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fill_bsc_measurement_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."fill_bsc_measurement_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fill_bsc_measurement_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_entry_number"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_entry_number"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_entry_number"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_inventory_adj_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_inventory_adj_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_inventory_adj_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_payslips_for_run"("p_run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_payslips_for_run"("p_run_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_payslips_for_run"("p_run_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_support_ticket_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_support_ticket_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_support_ticket_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_attendance_summary"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_attendance_summary"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_attendance_summary"("p_employee_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_audit_logs_with_users"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_audit_logs_with_users"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_audit_logs_with_users"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_budget_vs_actual"("p_org_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_budget_vs_actual"("p_org_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_budget_vs_actual"("p_org_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_consolidated_org_hierarchy"("p_parent_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_consolidated_org_hierarchy"("p_parent_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_consolidated_org_hierarchy"("p_parent_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_consolidated_org_ids"("p_parent_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_consolidated_org_ids"("p_parent_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_consolidated_org_ids"("p_parent_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_default_branch_id"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_default_branch_id"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_default_branch_id"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_org_ids_v3"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_org_ids_v3"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_org_ids_v3"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_sales_non_salam_stock_after_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_sales_non_salam_stock_after_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_sales_non_salam_stock_after_delivery"() TO "service_role";



GRANT ALL ON FUNCTION "public"."inject_shariah_coa"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."inject_shariah_coa"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inject_shariah_coa"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_main_organization"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_main_organization"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_main_organization"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_admin"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_admin"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_admin"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_admin_v3"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_admin_v3"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_admin_v3"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_in_consolidation_tree"("p_target_org_id" "uuid", "p_parent_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_in_consolidation_tree"("p_target_org_id" "uuid", "p_parent_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_in_consolidation_tree"("p_target_org_id" "uuid", "p_parent_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."nizam_has_permission"("p_permission" "text", "p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."nizam_has_permission"("p_permission" "text", "p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."nizam_has_permission"("p_permission" "text", "p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_measurement_unit"("p_unit" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_measurement_unit"("p_unit" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_measurement_unit"("p_unit" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_overlapping_fleet_bookings"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_overlapping_fleet_bookings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_overlapping_fleet_bookings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_asset_disposal"("p_org_id" "uuid", "p_asset_id" "uuid", "p_sale_price" numeric, "p_sale_date" "date", "p_cash_account_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_asset_disposal"("p_org_id" "uuid", "p_asset_id" "uuid", "p_sale_price" numeric, "p_sale_date" "date", "p_cash_account_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_asset_disposal"("p_org_id" "uuid", "p_asset_id" "uuid", "p_sale_price" numeric, "p_sale_date" "date", "p_cash_account_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_expense_claim"("p_claim_id" "uuid", "p_approved_by" "uuid", "p_expense_account_id" "uuid", "p_payable_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_expense_claim"("p_claim_id" "uuid", "p_approved_by" "uuid", "p_expense_account_id" "uuid", "p_payable_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_expense_claim"("p_claim_id" "uuid", "p_approved_by" "uuid", "p_expense_account_id" "uuid", "p_payable_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_org_id" "uuid", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_org_id" "uuid", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_inventory_adjustment"("p_adj_id" "uuid", "p_org_id" "uuid", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_inventory_transfer"("p_transfer_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_inventory_transfer"("p_transfer_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_inventory_transfer"("p_transfer_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_payroll_payment"("p_run_id" "uuid", "p_bank_account_id" "uuid", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_payroll_payment"("p_run_id" "uuid", "p_bank_account_id" "uuid", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_payroll_payment"("p_run_id" "uuid", "p_bank_account_id" "uuid", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_purchase_atomic"("p_org_id" "uuid", "p_vendor_id" "uuid", "p_date" timestamp with time zone, "p_due_date" "date", "p_total" numeric, "p_tax" numeric, "p_shipping" numeric, "p_grand_total" numeric, "p_notes" "text", "p_lines" "jsonb", "p_user_id" "uuid", "p_branch_id" "uuid", "p_shariah_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_purchase_atomic"("p_org_id" "uuid", "p_vendor_id" "uuid", "p_date" timestamp with time zone, "p_due_date" "date", "p_total" numeric, "p_tax" numeric, "p_shipping" numeric, "p_grand_total" numeric, "p_notes" "text", "p_lines" "jsonb", "p_user_id" "uuid", "p_branch_id" "uuid", "p_shariah_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_purchase_atomic"("p_org_id" "uuid", "p_vendor_id" "uuid", "p_date" timestamp with time zone, "p_due_date" "date", "p_total" numeric, "p_tax" numeric, "p_shipping" numeric, "p_grand_total" numeric, "p_notes" "text", "p_lines" "jsonb", "p_user_id" "uuid", "p_branch_id" "uuid", "p_shariah_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_purchase_payment_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_purchase_payment_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_purchase_payment_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_purchase_return_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_return_number" "text", "p_return_date" timestamp with time zone, "p_notes" "text", "p_items" "jsonb", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_purchase_return_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_return_number" "text", "p_return_date" timestamp with time zone, "p_notes" "text", "p_items" "jsonb", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_purchase_return_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_return_number" "text", "p_return_date" timestamp with time zone, "p_notes" "text", "p_items" "jsonb", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_warehouse_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_warehouse_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_sales_delivery_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_warehouse_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_sales_payment_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_sales_payment_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_sales_payment_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_account_id" "uuid", "p_amount" numeric, "p_discount" numeric, "p_payment_date" timestamp with time zone, "p_notes" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_sales_return_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_return_number" "text", "p_nota_retur" "text", "p_items" "jsonb", "p_user_id" "uuid", "p_refund_account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_sales_return_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_return_number" "text", "p_nota_retur" "text", "p_items" "jsonb", "p_user_id" "uuid", "p_refund_account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_sales_return_atomic"("p_org_id" "uuid", "p_sale_id" "uuid", "p_return_number" "text", "p_nota_retur" "text", "p_items" "jsonb", "p_user_id" "uuid", "p_refund_account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_work_order_completion"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_work_order_completion"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_work_order_completion"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_work_order_completion_v2"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid", "p_bin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_work_order_completion_v2"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid", "p_bin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_work_order_completion_v2"("p_wo_id" "uuid", "p_user_id" "uuid", "p_warehouse_id" "uuid", "p_bin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_average_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_average_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_average_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_coa_request"("p_request_id" "uuid", "p_review_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_coa_request"("p_request_id" "uuid", "p_review_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_coa_request"("p_request_id" "uuid", "p_review_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."repair_bank_transaction_report_sync"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."repair_bank_transaction_report_sync"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."repair_bank_transaction_report_sync"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_org_data"("p_org_id" "uuid", "p_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_org_data"("p_org_id" "uuid", "p_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_org_data"("p_org_id" "uuid", "p_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_inventory_asset_account"("p_org_id" "uuid", "p_product_id" "uuid", "p_fallback_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_inventory_asset_account"("p_org_id" "uuid", "p_product_id" "uuid", "p_fallback_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_inventory_asset_account"("p_org_id" "uuid", "p_product_id" "uuid", "p_fallback_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_single_active_branch"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_single_active_branch"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_single_active_branch"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_single_active_warehouse"("p_org_id" "uuid", "p_branch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_single_active_warehouse"("p_org_id" "uuid", "p_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_single_active_warehouse"("p_org_id" "uuid", "p_branch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_stock_movement_branch_id"("p_reference_type" "text", "p_reference_id" "uuid", "p_warehouse_id" "uuid", "p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_stock_movement_branch_id"("p_reference_type" "text", "p_reference_id" "uuid", "p_warehouse_id" "uuid", "p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_stock_movement_branch_id"("p_reference_type" "text", "p_reference_id" "uuid", "p_warehouse_id" "uuid", "p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_coa"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_coa"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_coa"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_default_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_default_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_adj_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_adj_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_adj_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_asset_depreciation_log_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_asset_depreciation_log_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_asset_depreciation_log_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_attendance_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_attendance_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_attendance_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_bank_account_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_bank_account_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_bank_account_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_bank_mutation_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_bank_mutation_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_bank_mutation_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_bank_transaction_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_bank_transaction_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_bank_transaction_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_budget_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_budget_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_budget_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_default_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_default_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_default_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_entry_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_entry_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_entry_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_expense_claim_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_expense_claim_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_expense_claim_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_fleet_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_fleet_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_fleet_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_journal_entry_default_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_journal_entry_default_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_journal_entry_default_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_leave_request_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_leave_request_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_leave_request_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_purchase_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_purchase_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_purchase_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_request_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_request_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_request_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_sale_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_sale_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sale_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_sale_warehouse_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_sale_warehouse_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sale_warehouse_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_sales_item_branch_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_sales_item_branch_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sales_item_branch_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_stock_movement_branch_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_stock_movement_branch_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_stock_movement_branch_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_transfer_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_transfer_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_transfer_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_coa_request"("p_business_reason" "text", "p_parent_org_id" "uuid", "p_proposed_code" "text", "p_proposed_description" "text", "p_proposed_name" "text", "p_proposed_normal_balance" "text", "p_proposed_parent_id" "uuid", "p_proposed_type" "text", "p_requester_branch_id" "uuid", "p_requester_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_coa_request"("p_business_reason" "text", "p_parent_org_id" "uuid", "p_proposed_code" "text", "p_proposed_description" "text", "p_proposed_name" "text", "p_proposed_normal_balance" "text", "p_proposed_parent_id" "uuid", "p_proposed_type" "text", "p_requester_branch_id" "uuid", "p_requester_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_coa_request"("p_business_reason" "text", "p_parent_org_id" "uuid", "p_proposed_code" "text", "p_proposed_description" "text", "p_proposed_name" "text", "p_proposed_normal_balance" "text", "p_proposed_parent_id" "uuid", "p_proposed_type" "text", "p_requester_branch_id" "uuid", "p_requester_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_bsc_cycle_scope_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_bsc_cycle_scope_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_bsc_cycle_scope_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_parent_roles_to_child_org"("p_parent_org_id" "uuid", "p_child_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_parent_roles_to_child_org"("p_parent_org_id" "uuid", "p_child_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_parent_roles_to_child_org"("p_parent_org_id" "uuid", "p_child_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_parent_roles_to_children"("p_parent_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_parent_roles_to_children"("p_parent_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_parent_roles_to_children"("p_parent_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_coa_request_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_coa_request_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_coa_request_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_sync_parent_roles_after_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_sync_parent_roles_after_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_sync_parent_roles_after_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_seed_coa"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_seed_coa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_seed_coa"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_seed_inventory_segment_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_seed_inventory_segment_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_seed_inventory_segment_accounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_journal_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_journal_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_journal_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_journal_balance_on_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_journal_balance_on_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_journal_balance_on_post"() TO "service_role";



GRANT ALL ON FUNCTION "public"."void_payroll_run"("p_run_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."void_payroll_run"("p_run_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_payroll_run"("p_run_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."void_purchase_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."void_purchase_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_purchase_atomic"("p_org_id" "uuid", "p_purchase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "postgres";
GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "dashboard_user";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."journal_lines" TO "anon";
GRANT ALL ON TABLE "public"."journal_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_lines" TO "service_role";



GRANT ALL ON TABLE "public"."account_balances" TO "anon";
GRANT ALL ON TABLE "public"."account_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."account_balances" TO "service_role";



GRANT ALL ON TABLE "public"."ai_token_topup_orders" TO "anon";
GRANT ALL ON TABLE "public"."ai_token_topup_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_token_topup_orders" TO "service_role";



GRANT ALL ON TABLE "public"."ai_token_topup_packages" TO "anon";
GRANT ALL ON TABLE "public"."ai_token_topup_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_token_topup_packages" TO "service_role";



GRANT ALL ON TABLE "public"."ai_token_usage_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_token_usage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_token_usage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_token_wallets" TO "anon";
GRANT ALL ON TABLE "public"."ai_token_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_token_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."approval_requests" TO "anon";
GRANT ALL ON TABLE "public"."approval_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_requests" TO "service_role";



GRANT ALL ON TABLE "public"."asset_depreciation_logs" TO "anon";
GRANT ALL ON TABLE "public"."asset_depreciation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_depreciation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."bank_mutations" TO "anon";
GRANT ALL ON TABLE "public"."bank_mutations" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_mutations" TO "service_role";



GRANT ALL ON TABLE "public"."bank_transactions" TO "anon";
GRANT ALL ON TABLE "public"."bank_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."bank_branch_backfill_audit" TO "anon";
GRANT ALL ON TABLE "public"."bank_branch_backfill_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_branch_backfill_audit" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."bsc_cycles" TO "anon";
GRANT ALL ON TABLE "public"."bsc_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."bsc_cycles" TO "service_role";



GRANT ALL ON TABLE "public"."bsc_kpi_measurements" TO "anon";
GRANT ALL ON TABLE "public"."bsc_kpi_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."bsc_kpi_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."bsc_kpis" TO "anon";
GRANT ALL ON TABLE "public"."bsc_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."bsc_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."bsc_perspective_weights" TO "anon";
GRANT ALL ON TABLE "public"."bsc_perspective_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."bsc_perspective_weights" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."budget_branch_backfill_audit" TO "anon";
GRANT ALL ON TABLE "public"."budget_branch_backfill_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_branch_backfill_audit" TO "service_role";



GRANT ALL ON TABLE "public"."coa_account_requests" TO "anon";
GRANT ALL ON TABLE "public"."coa_account_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."coa_account_requests" TO "service_role";



GRANT ALL ON TABLE "public"."coa_request_summary" TO "anon";
GRANT ALL ON TABLE "public"."coa_request_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."coa_request_summary" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."employee_components" TO "anon";
GRANT ALL ON TABLE "public"."employee_components" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_components" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."expense_claims" TO "anon";
GRANT ALL ON TABLE "public"."expense_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_claims" TO "service_role";



GRANT ALL ON TABLE "public"."production_work_orders" TO "anon";
GRANT ALL ON TABLE "public"."production_work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."production_work_orders" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."factory_branch_backfill_audit" TO "anon";
GRANT ALL ON TABLE "public"."factory_branch_backfill_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."factory_branch_backfill_audit" TO "service_role";



GRANT ALL ON TABLE "public"."fiscal_periods" TO "anon";
GRANT ALL ON TABLE "public"."fiscal_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."fiscal_periods" TO "service_role";



GRANT ALL ON TABLE "public"."fixed_assets" TO "anon";
GRANT ALL ON TABLE "public"."fixed_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."fixed_assets" TO "service_role";



GRANT ALL ON TABLE "public"."fixed_asset_branch_backfill_audit" TO "anon";
GRANT ALL ON TABLE "public"."fixed_asset_branch_backfill_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."fixed_asset_branch_backfill_audit" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_assets" TO "anon";
GRANT ALL ON TABLE "public"."fleet_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_assets" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_bookings" TO "anon";
GRANT ALL ON TABLE "public"."fleet_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_maintenance_labs" TO "anon";
GRANT ALL ON TABLE "public"."fleet_maintenance_labs" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_maintenance_labs" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_routes" TO "anon";
GRANT ALL ON TABLE "public"."fleet_routes" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_routes" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_schedules" TO "anon";
GRANT ALL ON TABLE "public"."fleet_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_terminals" TO "anon";
GRANT ALL ON TABLE "public"."fleet_terminals" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_terminals" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_tickets" TO "anon";
GRANT ALL ON TABLE "public"."fleet_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."intercompany_accounts" TO "anon";
GRANT ALL ON TABLE "public"."intercompany_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."intercompany_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."intercompany_transactions" TO "anon";
GRANT ALL ON TABLE "public"."intercompany_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."intercompany_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_adjustment_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_adjustment_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_adjustment_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."inventory_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."warehouses" TO "anon";
GRANT ALL ON TABLE "public"."warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouses" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_branch_backfill_audit" TO "anon";
GRANT ALL ON TABLE "public"."inventory_branch_backfill_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_branch_backfill_audit" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_stocks" TO "anon";
GRANT ALL ON TABLE "public"."inventory_stocks" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_stocks" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transfer_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transfer_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transfer_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transfers" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entry_branch_backfill_audit" TO "anon";
GRANT ALL ON TABLE "public"."journal_entry_branch_backfill_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entry_branch_backfill_audit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."journal_entry_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."journal_entry_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."journal_entry_seq" TO "service_role";



GRANT ALL ON TABLE "public"."leave_requests" TO "anon";
GRANT ALL ON TABLE "public"."leave_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_requests" TO "service_role";



GRANT ALL ON TABLE "public"."org_members" TO "anon";
GRANT ALL ON TABLE "public"."org_members" TO "authenticated";
GRANT ALL ON TABLE "public"."org_members" TO "service_role";



GRANT ALL ON TABLE "public"."leave_approval_backfill_audit" TO "anon";
GRANT ALL ON TABLE "public"."leave_approval_backfill_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_approval_backfill_audit" TO "service_role";



GRANT ALL ON TABLE "public"."org_invitations" TO "anon";
GRANT ALL ON TABLE "public"."org_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."org_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."org_member_units" TO "anon";
GRANT ALL ON TABLE "public"."org_member_units" TO "authenticated";
GRANT ALL ON TABLE "public"."org_member_units" TO "service_role";



GRANT ALL ON TABLE "public"."orphan_journal_entry_audit" TO "anon";
GRANT ALL ON TABLE "public"."orphan_journal_entry_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."orphan_journal_entry_audit" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_components" TO "anon";
GRANT ALL ON TABLE "public"."payroll_components" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_components" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_runs" TO "anon";
GRANT ALL ON TABLE "public"."payroll_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_runs" TO "service_role";



GRANT ALL ON TABLE "public"."payslip_lines" TO "anon";
GRANT ALL ON TABLE "public"."payslip_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."payslip_lines" TO "service_role";



GRANT ALL ON TABLE "public"."payslips" TO "anon";
GRANT ALL ON TABLE "public"."payslips" TO "authenticated";
GRANT ALL ON TABLE "public"."payslips" TO "service_role";



GRANT ALL ON TABLE "public"."production_bom_items" TO "anon";
GRANT ALL ON TABLE "public"."production_bom_items" TO "authenticated";
GRANT ALL ON TABLE "public"."production_bom_items" TO "service_role";



GRANT ALL ON TABLE "public"."production_boms" TO "anon";
GRANT ALL ON TABLE "public"."production_boms" TO "authenticated";
GRANT ALL ON TABLE "public"."production_boms" TO "service_role";



GRANT ALL ON TABLE "public"."production_wo_costs" TO "anon";
GRANT ALL ON TABLE "public"."production_wo_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."production_wo_costs" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_payments" TO "anon";
GRANT ALL ON TABLE "public"."purchase_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_payments" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_requests" TO "anon";
GRANT ALL ON TABLE "public"."purchase_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_requests" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_return_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_return_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_return_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_returns" TO "anon";
GRANT ALL ON TABLE "public"."purchase_returns" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_returns" TO "service_role";



GRANT ALL ON TABLE "public"."purchases" TO "anon";
GRANT ALL ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON TABLE "public"."reimbursements" TO "anon";
GRANT ALL ON TABLE "public"."reimbursements" TO "authenticated";
GRANT ALL ON TABLE "public"."reimbursements" TO "service_role";



GRANT ALL ON TABLE "public"."reimbursement_branch_backfill_audit" TO "anon";
GRANT ALL ON TABLE "public"."reimbursement_branch_backfill_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."reimbursement_branch_backfill_audit" TO "service_role";



GRANT ALL ON TABLE "public"."reimbursement_items" TO "anon";
GRANT ALL ON TABLE "public"."reimbursement_items" TO "authenticated";
GRANT ALL ON TABLE "public"."reimbursement_items" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."saas_config" TO "anon";
GRANT ALL ON TABLE "public"."saas_config" TO "authenticated";
GRANT ALL ON TABLE "public"."saas_config" TO "service_role";



GRANT ALL ON TABLE "public"."saas_invoices" TO "anon";
GRANT ALL ON TABLE "public"."saas_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."saas_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."saas_packages" TO "anon";
GRANT ALL ON TABLE "public"."saas_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."saas_packages" TO "service_role";



GRANT ALL ON TABLE "public"."saas_vouchers" TO "anon";
GRANT ALL ON TABLE "public"."saas_vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."saas_vouchers" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."sales_delivery_warehouse_audit" TO "anon";
GRANT ALL ON TABLE "public"."sales_delivery_warehouse_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_delivery_warehouse_audit" TO "service_role";



GRANT ALL ON TABLE "public"."sales_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_items" TO "service_role";



GRANT ALL ON TABLE "public"."sales_page_leads" TO "anon";
GRANT ALL ON TABLE "public"."sales_page_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_page_leads" TO "service_role";



GRANT ALL ON TABLE "public"."sales_pages" TO "anon";
GRANT ALL ON TABLE "public"."sales_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_pages" TO "service_role";



GRANT ALL ON TABLE "public"."sales_payments" TO "anon";
GRANT ALL ON TABLE "public"."sales_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_payments" TO "service_role";



GRANT ALL ON TABLE "public"."sales_return_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_return_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_return_items" TO "service_role";



GRANT ALL ON TABLE "public"."sales_returns" TO "anon";
GRANT ALL ON TABLE "public"."sales_returns" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_returns" TO "service_role";



GRANT ALL ON TABLE "public"."service_orders" TO "anon";
GRANT ALL ON TABLE "public"."service_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."service_orders" TO "service_role";



GRANT ALL ON TABLE "public"."support_ticket_updates" TO "anon";
GRANT ALL ON TABLE "public"."support_ticket_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."support_ticket_updates" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."v_ap_aging_report" TO "anon";
GRANT ALL ON TABLE "public"."v_ap_aging_report" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ap_aging_report" TO "service_role";



GRANT ALL ON TABLE "public"."v_ar_aging_report" TO "anon";
GRANT ALL ON TABLE "public"."v_ar_aging_report" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ar_aging_report" TO "service_role";



GRANT ALL ON TABLE "public"."v_bsc_latest_kpi_measurements" TO "anon";
GRANT ALL ON TABLE "public"."v_bsc_latest_kpi_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bsc_latest_kpi_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."v_budget_vs_actual" TO "anon";
GRANT ALL ON TABLE "public"."v_budget_vs_actual" TO "authenticated";
GRANT ALL ON TABLE "public"."v_budget_vs_actual" TO "service_role";



GRANT ALL ON TABLE "public"."v_consolidated_journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."v_consolidated_journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."v_consolidated_journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."v_employee_details" TO "anon";
GRANT ALL ON TABLE "public"."v_employee_details" TO "authenticated";
GRANT ALL ON TABLE "public"."v_employee_details" TO "service_role";



GRANT ALL ON TABLE "public"."v_sales_growth_analysis" TO "anon";
GRANT ALL ON TABLE "public"."v_sales_growth_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sales_growth_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."warehouse_bins" TO "anon";
GRANT ALL ON TABLE "public"."warehouse_bins" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouse_bins" TO "service_role";



GRANT ALL ON TABLE "public"."zakat_asset_timeline" TO "anon";
GRANT ALL ON TABLE "public"."zakat_asset_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."zakat_asset_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."zakat_haul" TO "anon";
GRANT ALL ON TABLE "public"."zakat_haul" TO "authenticated";
GRANT ALL ON TABLE "public"."zakat_haul" TO "service_role";



GRANT ALL ON TABLE "public"."zakat_haul_events" TO "anon";
GRANT ALL ON TABLE "public"."zakat_haul_events" TO "authenticated";
GRANT ALL ON TABLE "public"."zakat_haul_events" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








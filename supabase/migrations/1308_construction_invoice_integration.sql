-- MIGRATION 1308: Construction → Accounting Invoice Integration
-- Tujuan:
--   1. Auto-generate invoice saat billing term status → BILLED
--   2. Track invoice reference di billing term
--   3. RPC untuk create invoice dari billing term

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add invoice tracking columns ke construction_billing_terms (if not exists)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.construction_billing_terms
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_date DATE,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_construction_billing_terms_invoice
  ON public.construction_billing_terms(invoice_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: createInvoiceFromConstructionBillingTerm
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.createInvoiceFromConstructionBillingTerm(
  p_org_id UUID,
  p_billing_term_id UUID,
  p_invoice_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  success BOOLEAN,
  invoice_id UUID,
  invoice_number TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_billing_term RECORD;
  v_project RECORD;
  v_client RECORD;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_item_description TEXT;
  v_next_seq INTEGER;
BEGIN
  -- Fetch billing term
  SELECT bt.*, cp.project_name, cp.project_code, cp.contract_value, cp.client_contact_id
  INTO v_billing_term
  FROM public.construction_billing_terms bt
  JOIN public.construction_projects cp ON bt.project_id = cp.id
  WHERE bt.id = p_billing_term_id AND bt.org_id = p_org_id;

  IF v_billing_term IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Billing term tidak ditemukan.'::TEXT;
    RETURN;
  END IF;

  -- Check if already invoiced
  IF v_billing_term.invoice_id IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Billing term sudah di-invoice sebelumnya.'::TEXT;
    RETURN;
  END IF;

  -- Fetch client contact
  IF v_billing_term.client_contact_id IS NOT NULL THEN
    SELECT id, name, email
    INTO v_client
    FROM public.contacts
    WHERE id = v_billing_term.client_contact_id;
  END IF;

  -- Generate invoice number
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number, '^[0-9]+') AS INTEGER)), 0) + 1
  INTO v_next_seq
  FROM public.invoices
  WHERE org_id = p_org_id AND EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM p_invoice_date);

  v_invoice_number := 'INV-' || TO_CHAR(p_invoice_date, 'YYYY') || '-' ||
                      LPAD(v_next_seq::TEXT, 6, '0') || '-CONSTR';

  -- Create invoice
  INSERT INTO public.invoices (
    org_id, invoice_number, invoice_date, due_date,
    customer_id, customer_name, customer_email,
    bill_to_name, bill_to_email,
    status, currency, notes
  )
  VALUES (
    p_org_id,
    v_invoice_number,
    p_invoice_date,
    COALESCE(v_billing_term.due_date, p_invoice_date + INTERVAL '30 days'),
    COALESCE(v_client.id, NULL::UUID),
    COALESCE(v_client.name, 'Client ' || v_billing_term.project_code),
    COALESCE(v_client.email, NULL),
    COALESCE(v_client.name, 'Client ' || v_billing_term.project_code),
    COALESCE(v_client.email, NULL),
    'DRAFT',
    'IDR',
    'Termin ' || v_billing_term.term_label || ' - ' || v_billing_term.project_code
  )
  RETURNING id INTO v_invoice_id;

  -- Build item description
  v_item_description := v_billing_term.term_label || ' (' ||
                        ROUND(v_billing_term.billing_percent, 1) || '% dari nilai kontrak)';

  -- Add invoice line item
  INSERT INTO public.invoice_items (
    invoice_id, item_number, description,
    quantity, unit_price, line_total,
    account_id, tax_treatment
  )
  VALUES (
    v_invoice_id,
    1,
    v_item_description,
    1,
    v_billing_term.billing_amount,
    v_billing_term.billing_amount,
    NULL::UUID,
    'NON_TAXABLE'
  );

  -- Update billing term dengan invoice reference
  UPDATE public.construction_billing_terms
  SET
    invoice_id = v_invoice_id,
    invoice_number = v_invoice_number,
    invoice_date = p_invoice_date,
    updated_at = NOW()
  WHERE id = p_billing_term_id;

  RETURN QUERY SELECT true, v_invoice_id, v_invoice_number, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';

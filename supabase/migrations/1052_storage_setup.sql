-- ============================================================
-- MIGRATION: Storage Infrastructure
-- Setup Buckets for Logos, Receipts, and Reports
-- ============================================================

-- 1. Create brand_assets bucket for Logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand_assets', 'brand_assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create receipts bucket for Financial Proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES for Storage (brand_assets)
-- ─────────────────────────────────────────────────────────────

-- Allow public read access to brand_assets
CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'brand_assets');

-- Allow authenticated users to upload their own org's assets
-- (We use the orgId in the path as defined in org.actions.ts: ${orgId}/logo-...)
CREATE POLICY "Org Member Upload" ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'brand_assets' AND 
    auth.role() = 'authenticated'
);

CREATE POLICY "Org Member Update" ON storage.objects FOR UPDATE
USING (bucket_id = 'brand_assets' AND auth.role() = 'authenticated');

CREATE POLICY "Org Member Delete" ON storage.objects FOR DELETE
USING (bucket_id = 'brand_assets' AND auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES for Storage (receipts)
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Authenticated Read Receipts" ON storage.objects FOR SELECT 
USING (bucket_id = 'receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated Upload Receipts" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');

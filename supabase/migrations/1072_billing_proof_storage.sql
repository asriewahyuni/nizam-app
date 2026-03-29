-- 1072_billing_proof_storage.sql
-- Create bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('billing-proofs', 'billing-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for Public Upload
CREATE POLICY "Public Upload Proofs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'billing-proofs');
CREATE POLICY "Public Read Proofs" ON storage.objects FOR SELECT USING (bucket_id = 'billing-proofs');


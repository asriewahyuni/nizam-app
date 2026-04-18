-- Migration: 1199_syirkah_tables.sql
-- Description: Create tables for Syirkah Module (Contracts and Members)

CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS public.syirkah_contracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    debt_allocation NUMERIC(15, 2) DEFAULT 0,
    qr_token VARCHAR(255) UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.syirkah_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.syirkah_contracts(id) ON DELETE CASCADE,
    member_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PEMODAL', 'PENGELOLA')),
    responsibility TEXT,
    profit_share_percentage NUMERIC(5, 2) DEFAULT 0 CHECK (profit_share_percentage >= 0 AND profit_share_percentage <= 100),
    capital_contribution NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS handle_updated_at_syirkah_contracts ON public.syirkah_contracts;
CREATE TRIGGER handle_updated_at_syirkah_contracts
    BEFORE UPDATE ON public.syirkah_contracts
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();

DROP TRIGGER IF EXISTS handle_updated_at_syirkah_members ON public.syirkah_members;
CREATE TRIGGER handle_updated_at_syirkah_members
    BEFORE UPDATE ON public.syirkah_members
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();

-- RLS Policies For syirkah_contracts
ALTER TABLE public.syirkah_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view syirkah contracts for their organizations"
    ON public.syirkah_contracts FOR SELECT
    USING (org_id IN (
        SELECT org_id FROM public.org_members 
        WHERE user_id = auth.uid() AND is_active = true
    ));

CREATE POLICY "Users can insert syirkah contracts for their organizations"
    ON public.syirkah_contracts FOR INSERT
    WITH CHECK (org_id IN (
        SELECT org_id FROM public.org_members 
        WHERE user_id = auth.uid() AND is_active = true
    ));

CREATE POLICY "Users can update syirkah contracts for their organizations"
    ON public.syirkah_contracts FOR UPDATE
    USING (org_id IN (
        SELECT org_id FROM public.org_members 
        WHERE user_id = auth.uid() AND is_active = true
    ));

CREATE POLICY "Users can delete syirkah contracts for their organizations"
    ON public.syirkah_contracts FOR DELETE
    USING (org_id IN (
        SELECT org_id FROM public.org_members 
        WHERE user_id = auth.uid() AND is_active = true
    ));

-- RLS Policies For syirkah_members
ALTER TABLE public.syirkah_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view syirkah members for their organizations contracts"
    ON public.syirkah_members FOR SELECT
    USING (contract_id IN (
        SELECT id FROM public.syirkah_contracts 
        WHERE org_id IN (
            SELECT org_id FROM public.org_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    ));

CREATE POLICY "Users can insert syirkah members for their organizations contracts"
    ON public.syirkah_members FOR INSERT
    WITH CHECK (contract_id IN (
        SELECT id FROM public.syirkah_contracts 
        WHERE org_id IN (
            SELECT org_id FROM public.org_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    ));

CREATE POLICY "Users can update syirkah members for their organizations contracts"
    ON public.syirkah_members FOR UPDATE
    USING (contract_id IN (
        SELECT id FROM public.syirkah_contracts 
        WHERE org_id IN (
            SELECT org_id FROM public.org_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    ));

CREATE POLICY "Users can delete syirkah members for their organizations contracts"
    ON public.syirkah_members FOR DELETE
    USING (contract_id IN (
        SELECT id FROM public.syirkah_contracts 
        WHERE org_id IN (
            SELECT org_id FROM public.org_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    ));

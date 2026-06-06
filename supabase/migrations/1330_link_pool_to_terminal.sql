-- ==========================================
-- SCRIPT 1330: LINK BUS POOLS TO FLEET TERMINALS
-- ==========================================

-- Tambahkan kolom terminal_id yang mereferensikan fleet_terminals
ALTER TABLE public.bus_pools
  ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.fleet_terminals(id) ON DELETE SET NULL;

-- Tambahkan index untuk optimasi query (contoh saat mencari Pool berdasarkan Terminal)
CREATE INDEX IF NOT EXISTS idx_bus_pools_terminal_id ON public.bus_pools(terminal_id);

-- Update komentar (opsional)
COMMENT ON COLUMN public.bus_pools.terminal_id IS 'Link ke entitas fisik geografis (fleet_terminals) tempat Agen/Pool ini beroperasi.';


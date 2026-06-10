-- Migration 1359: SPK (Surat Perintah Kerja)
-- Dokumen perintah kerja implementasi yang diterbitkan setelah penjualan dikonfirmasi,
-- sebagai bagian dari alur onboarding SaaS: Penjualan → SPK → UAT → BAST

CREATE TABLE spk_documents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES organizations(id),
  sale_invoice_id   uuid,                            -- referensi invoice penjualan (opsional)
  document_number   text        NOT NULL UNIQUE,
  issued_date       date        NOT NULL,
  start_date        date,                            -- rencana mulai implementasi
  end_date          date,                            -- rencana selesai implementasi
  system_name       text        NOT NULL DEFAULT 'Nizam ERP',
  modules_scope     text[]      NOT NULL DEFAULT '{}', -- modul yang akan diimplementasikan
  consultant_name   text,
  consultant_title  text,
  client_pic_name   text,
  client_pic_title  text,
  notes             text,
  status            text        NOT NULL DEFAULT 'DRAFT'
                                 CHECK (status IN ('DRAFT','ISSUED','IN_PROGRESS','COMPLETED')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spk_documents_org    ON spk_documents(org_id);
CREATE INDEX idx_spk_documents_status ON spk_documents(status);

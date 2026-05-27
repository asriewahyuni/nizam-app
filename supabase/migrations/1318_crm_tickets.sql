-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1318: CRM Tiket Layanan Pelanggan & Vendor
-- Tabel: crm_tickets, crm_ticket_notes
-- Ticket number format: TKT-YYYY-MM-NNN (per org per bulan)
-- Notification channel disiapkan (belum aktif — fase berikutnya WA/email)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── crm_tickets ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_tickets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id            UUID REFERENCES branches(id) ON DELETE SET NULL,

  -- Identifikasi
  ticket_number        VARCHAR(30) NOT NULL,
  source               VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER_FORM',
  -- CUSTOMER_FORM | VENDOR_FORM | STAFF

  -- Klasifikasi
  type                 VARCHAR(30) NOT NULL DEFAULT 'INQUIRY',
  -- COMPLAINT | REQUEST | INQUIRY | SUGGESTION
  priority             VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  -- LOW | MEDIUM | HIGH | URGENT
  status               VARCHAR(20) NOT NULL DEFAULT 'NEW',
  -- NEW | IN_PROGRESS | RESOLVED | CLOSED

  -- Konten
  subject              VARCHAR(255) NOT NULL,
  description          TEXT,
  resolution           TEXT,

  -- Submitter (dari public form — bisa bukan kontak yang ada di sistem)
  submitter_name       VARCHAR(150) NOT NULL,
  submitter_email      VARCHAR(255),
  submitter_phone      VARCHAR(50),

  -- Linking internal (opsional)
  contact_id           UUID REFERENCES contacts(id) ON DELETE SET NULL,
  reference_type       VARCHAR(20),   -- SALE | PURCHASE | null
  reference_id         UUID,
  assigned_to_user_id  UUID,          -- FK ke internal_auth_users (soft ref)
  due_date             DATE,

  -- Notification channel (disiapkan, belum aktif — fase WA/email berikutnya)
  notification_email   VARCHAR(255),  -- email balasan ke submitter
  notification_phone   VARCHAR(50),   -- WA number untuk blast balasan
  notification_sent_at TIMESTAMPTZ,   -- kapan notifikasi terakhir dikirim

  -- Timestamps
  resolved_at          TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, ticket_number)
);

-- ─── crm_ticket_notes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_ticket_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES crm_tickets(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_name  VARCHAR(150) NOT NULL,
  author_type  VARCHAR(20) NOT NULL DEFAULT 'STAFF',
  -- STAFF | SYSTEM | CUSTOMER (future: customer reply via link)
  content      TEXT NOT NULL,
  is_internal  BOOLEAN NOT NULL DEFAULT true,
  -- true  = hanya kelihatan oleh staff
  -- false = akan dikirim ke customer (belum aktif)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_tickets_org_id
  ON crm_tickets(org_id);

CREATE INDEX IF NOT EXISTS idx_crm_tickets_org_status
  ON crm_tickets(org_id, status);

CREATE INDEX IF NOT EXISTS idx_crm_tickets_org_created
  ON crm_tickets(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_tickets_contact
  ON crm_tickets(org_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_tickets_reference
  ON crm_tickets(org_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_ticket_notes_ticket
  ON crm_ticket_notes(ticket_id, created_at);

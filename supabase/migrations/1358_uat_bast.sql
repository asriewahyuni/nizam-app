-- Migration 1358: UAT & BAST
-- UAT (User Acceptance Testing) template reusable per modul + BAST (Berita Acara Serah Terima)

CREATE TABLE uat_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  description    text,
  applicable_modules text[]  NOT NULL DEFAULT '{}',
  is_active      boolean     NOT NULL DEFAULT true,
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE uat_template_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid        NOT NULL REFERENCES uat_templates(id) ON DELETE CASCADE,
  module_name     text        NOT NULL,
  category        text,
  test_scenario   text        NOT NULL,
  expected_result text        NOT NULL,
  order_index     integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE uat_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES organizations(id),
  template_id      uuid        NOT NULL REFERENCES uat_templates(id),
  session_number   text        NOT NULL UNIQUE,
  status           text        NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED')),
  start_date       date,
  completed_date   date,
  operator_notes   text,
  assigned_by      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE uat_session_results (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES uat_sessions(id) ON DELETE CASCADE,
  template_item_id uuid        NOT NULL REFERENCES uat_template_items(id),
  status           text        NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','PASS','FAIL','SKIP')),
  notes            text,
  tested_by        text,
  tested_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bast_documents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES organizations(id),
  uat_session_id    uuid        REFERENCES uat_sessions(id),
  document_number   text        NOT NULL UNIQUE,
  issued_date       date        NOT NULL,
  system_name       text        NOT NULL DEFAULT 'Nizam ERP',
  modules_delivered text[]      NOT NULL DEFAULT '{}',
  operator_name     text,
  operator_title    text,
  client_name       text,
  client_title      text,
  notes             text,
  status            text        NOT NULL DEFAULT 'DRAFT'
                                CHECK (status IN ('DRAFT','ISSUED')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uat_sessions_org        ON uat_sessions(org_id);
CREATE INDEX idx_uat_sessions_status     ON uat_sessions(status);
CREATE INDEX idx_uat_session_results_sid ON uat_session_results(session_id);
CREATE INDEX idx_bast_documents_org      ON bast_documents(org_id);
CREATE INDEX idx_bast_documents_uat      ON bast_documents(uat_session_id);

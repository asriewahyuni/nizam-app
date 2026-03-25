-- Migration 1034: Add Quotation Status to Document Enum
-- Allows the sales table to support Quotation (Penawaran Harga) documents.

ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'QUOTATION';

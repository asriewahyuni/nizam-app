-- Migration: 1129_branch_pic_column.sql
-- Menambahkan kolom pic_employee_id pada tabel branches
-- untuk fitur assign PIC (penanggung jawab) per cabang

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS pic_employee_id UUID
    REFERENCES employees(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON COLUMN branches.pic_employee_id IS
  'Karyawan yang ditunjuk sebagai PIC (penanggung jawab) cabang ini.';

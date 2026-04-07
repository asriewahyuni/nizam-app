# Migration Data Workspace

Folder ini berisi artifact kerja untuk migrasi data dari Supabase source ke database PostgreSQL lokal target.

## File yang dihasilkan

- `source_data.sql` — dump data source mentah
- `source_schema.sql` — dump schema source untuk analisis kompatibilitas
- `source_data_existing.sql` — dump data source yang sudah difilter agar hanya memuat tabel yang ada di target
- `truncate_tables.sql` — daftar truncate semua tabel source
- `truncate_existing_tables.sql` — truncate hanya untuk tabel yang ada di target aktif
- `add_missing_columns.sql` — patch compatibility columns yang diperlukan target

## Script terkait

- `scripts/export_supabase_data.sh`
- `scripts/load_local_target.sh`
- `scripts/validate_migration_counts.py`

## Catatan

Artifact di folder ini bersifat operasional dan bisa berubah setiap kali export/load dijalankan ulang.

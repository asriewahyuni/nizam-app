-- Izinkan user_type 'anggota' dan 'member' agar modul Kojasmat bisa membuat
-- akun internal_auth_users untuk calon anggota / anggota koperasi.
-- Sebelumnya constraint hanya mengizinkan owner/admin/staff (role org),
-- sehingga createInternalAuthUser() gagal dengan check constraint violation
-- saat dipanggil dari kojasmat-membership.actions.ts.
alter table public.internal_auth_users
  drop constraint internal_auth_users_user_type_check;

alter table public.internal_auth_users
  add constraint internal_auth_users_user_type_check
  check (user_type = any (array['owner', 'staff', 'admin', 'anggota', 'member']));

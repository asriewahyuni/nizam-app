'use server'

// Klinik Pratama — booking online (Fase 2b). Slot tersedia dihitung dari
// klinik_jadwal_praktik (jadwal rutin) dikurangi klinik_jadwal_pengecualian
// (cuti/libur) dikurangi klinik_slot_hold yang sudah terisi — di atas
// fondasi jadwal yang sama dipakai walk-in (Fase 1). Anti-double-booking
// ditegakkan di level database lewat EXCLUDE USING gist
// (supabase/migrations/1430_klinik_pratama_booking.sql), bukan hanya
// pengecekan di sini — jadi race condition dua booking bersamaan tetap aman
// walau logic TS ini punya celah.

import { revalidatePath } from 'next/cache'
import { queryPostgres } from '@/lib/db/postgres'

const SLOT_DURATION_MINUTES = 30

export type KlinikAvailableSlot = {
  stafMedisId: string
  stafMedisName: string
  startsAt: string
  endsAt: string
}

function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export async function getAvailableSlots(
  orgId: string,
  branchId: string,
  poliId: string,
  date: string,
): Promise<KlinikAvailableSlot[]> {
  const weekday = new Date(`${date}T00:00:00`).getDay()

  const { rows: jadwalRows } = await queryPostgres<{
    staf_medis_id: string; staf_medis_name: string; start_local: string; end_local: string
  }>(
    `SELECT jp.staf_medis_id::text,
            TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, ''))) AS staf_medis_name,
            jp.start_local::text, jp.end_local::text
     FROM public.klinik_jadwal_praktik jp
     JOIN public.klinik_staf_medis sm ON sm.id = jp.staf_medis_id
     JOIN public.employees e ON e.id = sm.employee_id
     WHERE jp.org_id = $1 AND jp.branch_id = $2 AND jp.poli_id = $3 AND jp.weekday = $4 AND jp.is_active = TRUE
       AND jp.valid_from <= $5::date AND (jp.valid_until IS NULL OR jp.valid_until >= $5::date)`,
    [orgId, branchId, poliId, weekday, date],
  )
  if (jadwalRows.length === 0) return []

  const stafMedisIds = [...new Set(jadwalRows.map((j) => j.staf_medis_id))]

  const { rows: pengecualianRows } = await queryPostgres<{ staf_medis_id: string; starts_at: string; ends_at: string }>(
    `SELECT staf_medis_id::text, starts_at::text, ends_at::text
     FROM public.klinik_jadwal_pengecualian
     WHERE org_id = $1 AND staf_medis_id = ANY($2::uuid[]) AND status = 'BLOCKED'
       AND starts_at < ($3::date + INTERVAL '1 day') AND ends_at > $3::date`,
    [orgId, stafMedisIds, date],
  )

  const { rows: takenRows } = await queryPostgres<{ staf_medis_id: string; starts_at: string; ends_at: string }>(
    `SELECT staf_medis_id::text, starts_at::text, ends_at::text
     FROM public.klinik_slot_hold
     WHERE org_id = $1 AND staf_medis_id = ANY($2::uuid[]) AND status IN ('HELD', 'CONFIRMED')
       AND starts_at < ($3::date + INTERVAL '1 day') AND ends_at > $3::date`,
    [orgId, stafMedisIds, date],
  )

  const slots: KlinikAvailableSlot[] = []
  const now = new Date()

  for (const jadwal of jadwalRows) {
    const startMin = timeStringToMinutes(jadwal.start_local)
    const endMin = timeStringToMinutes(jadwal.end_local)

    for (let t = startMin; t + SLOT_DURATION_MINUTES <= endMin; t += SLOT_DURATION_MINUTES) {
      const slotStart = new Date(`${date}T00:00:00`)
      slotStart.setMinutes(t)
      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60000)

      if (slotStart <= now) continue

      const blocked = pengecualianRows.some((p) =>
        p.staf_medis_id === jadwal.staf_medis_id
        && new Date(p.starts_at) < slotEnd && new Date(p.ends_at) > slotStart)
      if (blocked) continue

      const taken = takenRows.some((tk) =>
        tk.staf_medis_id === jadwal.staf_medis_id
        && new Date(tk.starts_at) < slotEnd && new Date(tk.ends_at) > slotStart)
      if (taken) continue

      slots.push({
        stafMedisId: jadwal.staf_medis_id,
        stafMedisName: jadwal.staf_medis_name,
        startsAt: slotStart.toISOString(),
        endsAt: slotEnd.toISOString(),
      })
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export async function createBookingSlot(input: {
  orgId: string
  branchId: string
  poliId: string
  stafMedisId: string
  startsAt: string
  endsAt: string
  pasienNama: string
  pasienKontak: string
  keluhan?: string | null
}): Promise<{ data: { id: string } } | { error: string }> {
  const pasienNama = input.pasienNama.trim()
  const pasienKontak = input.pasienKontak.trim()
  if (!pasienNama) return { error: 'Nama wajib diisi.' }
  if (!pasienKontak) return { error: 'Nomor kontak wajib diisi.' }

  try {
    const { rows } = await queryPostgres<{ id: string }>(
      `INSERT INTO public.klinik_slot_hold
         (org_id, branch_id, poli_id, staf_medis_id, starts_at, ends_at, status, pasien_nama, pasien_kontak, keluhan)
       VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', $7, $8, $9)
       RETURNING id::text`,
      [input.orgId, input.branchId, input.poliId, input.stafMedisId, input.startsAt, input.endsAt, pasienNama, pasienKontak, input.keluhan || null],
    )
    revalidatePath('/klinik')
    return { data: { id: rows[0].id } }
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (err.code === '23P01') {
      return { error: 'Slot ini baru saja dipesan orang lain. Silakan pilih jadwal lain.' }
    }
    return { error: err.message || 'Gagal membuat booking.' }
  }
}

export type KlinikBookingRow = {
  id: string
  poli_id: string
  staf_medis_id: string
  staf_medis_name: string
  starts_at: string
  ends_at: string
  pasien_nama: string
  pasien_kontak: string
  keluhan: string | null
  status: string
}

export async function getConfirmedBookingsToday(orgId: string, branchId: string, poliId: string): Promise<KlinikBookingRow[]> {
  const { rows } = await queryPostgres<KlinikBookingRow>(
    `SELECT sh.id::text, sh.poli_id::text, sh.staf_medis_id::text,
            TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, ''))) AS staf_medis_name,
            sh.starts_at::text, sh.ends_at::text, sh.pasien_nama, sh.pasien_kontak, sh.keluhan, sh.status
     FROM public.klinik_slot_hold sh
     JOIN public.klinik_staf_medis sm ON sm.id = sh.staf_medis_id
     JOIN public.employees e ON e.id = sm.employee_id
     WHERE sh.org_id = $1 AND sh.branch_id = $2 AND sh.poli_id = $3 AND sh.status = 'CONFIRMED'
       AND sh.starts_at >= CURRENT_DATE AND sh.starts_at < (CURRENT_DATE + INTERVAL '1 day')
     ORDER BY sh.starts_at ASC`,
    [orgId, branchId, poliId],
  )
  return rows
}

/** Check-in pasien booking di loket — buat/temukan klinik_pasien, buat kunjungan (sumber=BOOKING), tautkan slot_hold. */
export async function checkInBooking(
  orgId: string,
  branchId: string,
  slotHoldId: string,
): Promise<{ data: { kunjunganId: string; noAntrian: number } } | { error: string }> {
  const { rows } = await queryPostgres<{
    id: string; poli_id: string; staf_medis_id: string; pasien_nama: string; pasien_kontak: string; keluhan: string | null; status: string
  }>(
    `SELECT id::text, poli_id::text, staf_medis_id::text, pasien_nama, pasien_kontak, keluhan, status
     FROM public.klinik_slot_hold WHERE id = $1 AND org_id = $2`,
    [slotHoldId, orgId],
  )
  const booking = rows[0]
  if (!booking) return { error: 'Booking tidak ditemukan.' }
  if (booking.status !== 'CONFIRMED') return { error: 'Booking ini sudah tidak berstatus terkonfirmasi.' }

  let pasienId: string
  const { rows: existingPasien } = await queryPostgres<{ id: string }>(
    `SELECT id::text FROM public.klinik_pasien WHERE org_id = $1 AND no_hp = $2 AND is_active = TRUE LIMIT 1`,
    [orgId, booking.pasien_kontak],
  )
  if (existingPasien[0]) {
    pasienId = existingPasien[0].id
  } else {
    const { createKlinikPasien } = await import('./klinik-pasien.actions')
    const created = await createKlinikPasien(orgId, {
      nama: booking.pasien_nama,
      noHp: booking.pasien_kontak,
      registeredBranchId: branchId,
    })
    if ('error' in created) return { error: created.error }
    pasienId = created.data.id
  }

  const { createKunjunganWalkIn } = await import('./klinik-kunjungan.actions')
  const kunjunganResult = await createKunjunganWalkIn({
    orgId, branchId, pasienId, poliId: booking.poli_id, keluhan: booking.keluhan,
  })
  if ('error' in kunjunganResult) return { error: kunjunganResult.error }

  await queryPostgres(
    `UPDATE public.klinik_kunjungan SET staf_medis_id = $2, sumber = 'BOOKING' WHERE id = $1`,
    [kunjunganResult.data.id, booking.staf_medis_id],
  )
  await queryPostgres(
    `UPDATE public.klinik_slot_hold SET status = 'CHECKED_IN', kunjungan_id = $2 WHERE id = $1`,
    [slotHoldId, kunjunganResult.data.id],
  )

  revalidatePath('/klinik')
  return { data: { kunjunganId: kunjunganResult.data.id, noAntrian: kunjunganResult.data.no_antrian } }
}

'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createMurabahahAction(orgId: string, payload: {
  akad_wakalah_id?: string
  pembeli_id: string
  nama_barang: string
  harga_pokok: number
  margin: number
  tenor_bulan: number
}) {
  const db = await createAdminClient()
  const harga_jual = payload.harga_pokok + payload.margin
  const nomor_transaksi = `MUR/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`
  
  const { data, error } = await db.from('koperasi_murabahah_transaksi')
    .insert({
      org_id: orgId,
      ...payload,
      akad_wakalah_id: payload.akad_wakalah_id || null,
      harga_jual,
      nomor_transaksi,
      status: 'AKTIF',
      margin: payload.margin,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  
  // Auto-generate angsuran
  const angsuranJumlah = Math.ceil(harga_jual / payload.tenor_bulan)
  const dueDate = new Date()
  for (let i = 1; i <= payload.tenor_bulan; i++) {
    dueDate.setMonth(dueDate.getMonth() + 1)
    await db.from('koperasi_murabahah_angsuran')
      .insert({
        transaksi_id: data.id,
        angsuran_ke: i,
        jatuh_tempo: dueDate.toISOString().split('T')[0],
        jumlah: i === payload.tenor_bulan ? harga_jual - angsuranJumlah * (payload.tenor_bulan - 1) : angsuranJumlah,
        status: 'BELUM_BAYAR',
      })
  }
  
  revalidatePath('/koperasi/murabahah')
  return data
}

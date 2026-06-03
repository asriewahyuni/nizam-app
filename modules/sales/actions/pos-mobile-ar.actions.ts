'use server';

import { createClient } from '@/lib/supabase/server';
import { getActiveBranch } from '@/modules/organization/actions/org.actions';
import { revalidatePath } from 'next/cache';
import { queryPostgres } from '@/lib/db/postgres';

/**
 * Mendapatkan daftar pelanggan yang murni dibuat oleh/ditugaskan ke Canvaser ini.
 */
export async function getCanvasserContacts(orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  try {
    const result = await queryPostgres<any>(`
      SELECT id, name, type, address, phone, phone_wa 
      FROM contacts 
      WHERE org_id = $1 
        AND created_by = $2 
        AND is_active = true 
      ORDER BY name ASC
    `, [orgId, user.id]);
    
    return result.rows;
  } catch (error) {
    console.error('[getCanvasserContacts] Error:', error);
    return [];
  }
}

/**
 * Mendapatkan daftar tagihan Piutang (AR) pelanggan yang belum lunas.
 * Hanya menampilkan tagihan yang dibuat oleh Canvaser ini.
 */
export async function getCustomerOutstandingAR(orgId: string, customerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  try {
    const result = await queryPostgres<any>(`
      SELECT 
        id, 
        sale_number, 
        sale_date, 
        due_date, 
        grand_total, 
        pos_amount_tendered,
        (grand_total - COALESCE((SELECT SUM(amount) FROM sales_payments WHERE sale_id = sales.id), 0)) as outstanding_amount,
        status, 
        payment_status 
      FROM sales 
      WHERE org_id = $1 
        AND customer_id = $2 
        AND payment_status != 'PAID'
        AND status != 'VOIDED'
        AND status != 'DRAFT'
      ORDER BY sale_date ASC
    `, [orgId, customerId]);
    
    return result.rows.map((row) => ({
      ...row,
      outstanding_amount: Number(row.outstanding_amount)
    }));
  } catch (error) {
    console.error('[getCustomerOutstandingAR] Error:', error);
    return [];
  }
}

/**
 * Mencatat pembayaran tagihan Piutang (AR) dari Canvaser.
 */
export async function processArCollection(orgId: string, payload: {
  customerId: string;
  saleId: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
  posSessionId?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const activeBranch = await getActiveBranch(orgId);
  if (!activeBranch) return { error: 'Unit aktif tidak ditemukan.' };

  // 1. Dapatkan data tagihan saat ini
  const { data: sale, error: saleError } = await (supabase as any)
    .from('sales')
    .select('id, grand_total, payment_status, pos_session_id')
    .eq('id', payload.saleId)
    .eq('org_id', orgId)
    .single();

  if (saleError || !sale) {
    return { error: 'Tagihan tidak ditemukan.' };
  }

  // Cek total pembayaran yang sudah masuk sebelumnya
  const { data: previousPayments, error: prevPayError } = await (supabase as any)
    .from('sales_payments')
    .select('amount')
    .eq('sale_id', payload.saleId);

  const totalPaidBefore = previousPayments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
  const newTotalPaid = totalPaidBefore + payload.amount;
  const grandTotal = Number(sale.grand_total);
  
  // 2. Insert riwayat pembayaran
  const { error: paymentError } = await (supabase as any)
    .from('sales_payments')
    .insert({
      org_id: orgId,
      branch_id: activeBranch.id,
      sale_id: payload.saleId,
      amount: payload.amount,
      payment_method: payload.paymentMethod,
      pos_session_id: payload.posSessionId || null,
      notes: payload.notes || 'Pelunasan via Mobile POS (Canvassing)',
      created_by: user.id
    });

  if (paymentError) {
    return { error: 'Gagal mencatat pembayaran: ' + paymentError.message };
  }

  // 3. Update status pembayaran di tabel sales
  const newPaymentStatus = newTotalPaid >= grandTotal ? 'PAID' : 'PARTIAL';
  const { error: updateError } = await (supabase as any)
    .from('sales')
    .update({ 
      payment_status: newPaymentStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', payload.saleId);

  if (updateError) {
    return { error: 'Gagal memperbarui status tagihan: ' + updateError.message };
  }

  revalidatePath('/pos-mobile');
  return { success: true, paymentStatus: newPaymentStatus };
}

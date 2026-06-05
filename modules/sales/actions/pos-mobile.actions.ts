'use server';

import { createClient } from '@/lib/supabase/server';
import { getProducts } from '@/modules/inventory/actions/inventory.actions';
import { createSaleEntry, deliverSale } from '@/modules/sales/actions/sales.actions';

export async function getPosMobileProducts(orgId: string, warehouseId: string | null) {
  const supabase = await createClient();
  
  const { data: productsData } = await (supabase as any)
    .from('products')
    .select('id, name, selling_price, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (!productsData) return [];

  let currentStocks: any[] = [];
  if (warehouseId) {
    const { data: stockRows } = await (supabase as any)
      .from('inventory_stocks')
      .select('product_id, quantity')
      .eq('org_id', orgId)
      .eq('warehouse_id', warehouseId);
      
    currentStocks = stockRows || [];
  }

  const stockByProduct: Record<string, number> = {};
  currentStocks.forEach((stock: any) => {
    stockByProduct[stock.product_id] = (stockByProduct[stock.product_id] || 0) + Number(stock.quantity || 0);
  });

  return productsData.map((p: any) => ({
    id: p.id,
    name: p.name,
    price: p.selling_price || 0,
    stock: stockByProduct[p.id] || 0,
    isTradeIn: p.selling_price ? p.selling_price < 0 : false
  }));
}

export async function checkoutPosMobile(orgId: string, payload: any) {
  const result = await createSaleEntry(orgId, payload);
  
  if (result.error || !result.saleId) {
    return result;
  }
  
  const saleId = result.saleId;
  const supabase = await createClient();

  // 1. Auto-Approve the SO for Canvassing
  await (supabase as any).from('sales').update({ status: 'PUBLISHED' }).eq('id', saleId);
  await (supabase as any).from('approval_requests')
    .update({ 
      status: 'APPROVED', 
      decided_at: new Date().toISOString(), 
      reason: 'Auto-approved via POS Mobile (Canvassing)' 
    })
    .eq('source_type', 'SALES_ORDER')
    .eq('source_id', saleId);

  // 2. Auto-Deliver to deduct inventory immediately
  const deliveryResult = await deliverSale(orgId, saleId, payload.warehouse_id || null);

  if (deliveryResult.error) {
    return { 
      ...result, 
      warning: `Pesanan berhasil dicatat, tetapi pemotongan stok otomatis gagal: ${deliveryResult.error}` 
    };
  }

  return result;
}

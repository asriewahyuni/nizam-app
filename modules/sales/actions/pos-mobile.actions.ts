'use server';

import { getProducts } from '@/modules/inventory/actions/inventory.actions';
import { createSaleEntry } from '@/modules/sales/actions/sales.actions';

export async function getPosMobileProducts(orgId: string, branchId: string | null) {
  const products = await getProducts(orgId, branchId);
  
  const posProducts = products
    .filter(p => p.is_active)
    .map(p => ({
      id: p.id,
      name: p.name,
      price: p.selling_price || 0,
      stock: p.stock_available,
      isTradeIn: p.selling_price ? p.selling_price < 0 : false
    }));
    
  return posProducts;
}

export async function checkoutPosMobile(orgId: string, payload: any) {
  return createSaleEntry(orgId, payload);
}
